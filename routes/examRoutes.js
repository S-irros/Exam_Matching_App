import express from "express";
import mongoose from "mongoose";
import User from "../models/User.model.js";
import Exam from "../models/examModel.js";
import ExamRecord from "../models/examRecordModel.js";
import Question from "../models/questionModel.js";
import Point from "../models/pointModel.js";
import Rank from "../models/rankModel.js";
import StudentAnswer from "../models/studentAnswerModel.js";
import { calculateScore } from "../services/examService.js";

const router = express.Router();

const updateRanks = async () => {
  try {
    console.log("🔍 Fetching points...");
    const points = await Point.find().sort({ totalPoints: -1 }).lean();
    console.log("📊 Points found:", points.length, points);

    if (points.length === 0) {
      console.log("⚠️ No points found, skipping rank update");
      return;
    }

    console.log("🔍 Fetching users...");
    const users = await User.find({
      randomId: { $in: points.map((p) => p.studentId) },
    }).lean();
    console.log("👥 Users found:", users.length, users);

    const userMap = new Map(users.map((u) => [u.randomId, u.name]));
    const ranks = points.map((point, index) => ({
      studentId: point.studentId,
      name: userMap.get(point.studentId) || "Unknown",
      totalPoints: point.totalPoints,
      rank: index + 1,
      updatedAt: new Date(),
    }));

    console.log("🏆 Ranks to be saved:", ranks);
    console.log("🗑️ Deleting old ranks...");
    await Rank.deleteMany({});
    console.log("🗑️ Old ranks deleted");
    console.log("💾 Inserting new ranks...");
    await Rank.insertMany(ranks);
    console.log("💾 Ranks updated in database:", ranks.length, "entries");
  } catch (error) {
    console.error(
      "❌ Error updating ranks in updateRanks:",
      error.message,
      error.stack
    );
    throw error;
  }
};

export async function startExam(student1, student2) {
  try {
    const studentIds = [student1.student_id, student2.student_id];
    const subjectId = student1.subjectId;
    const gradeLevelId = student1.gradeLevelId;

    const [user1, user2] = await Promise.all([
      User.findOne({ randomId: student1.student_id }).select("totalPoints"),
      User.findOne({ randomId: student2.student_id }).select("totalPoints"),
    ]);
    const totalPoints1 = user1?.totalPoints || 0;
    const totalPoints2 = user2?.totalPoints || 0;
    let difficulty;
    const maxPoints = Math.max(totalPoints1, totalPoints2);
    if (maxPoints <= 400) difficulty = "easy";
    else if (maxPoints <= 800) difficulty = "medium";
    else if (maxPoints <= 1200) difficulty = "hard";
    else difficulty = ["easy", "medium", "hard"];

    const allQuestions = await Question.find({
      subjectId,
      gradeLevelId,
    }).select("_id questionText options marks difficultyLevel correctAnswer");

    if (allQuestions.length === 0) {
      console.log(
        `❌ No questions found in database for subjectId: ${subjectId}, gradeLevelId: ${gradeLevelId}`
      );
      throw new Error("No questions found in database");
    }

    let availableQuestions = allQuestions.filter((q) =>
      Array.isArray(difficulty)
        ? difficulty.includes(q.difficultyLevel)
        : q.difficultyLevel === difficulty
    );

    if (availableQuestions.length === 0) {
      console.log(
        `⚠️ No questions available for difficulty level: ${
          Array.isArray(difficulty) ? difficulty.join(", ") : difficulty
        } with subjectId: ${subjectId}, gradeLevelId: ${gradeLevelId}`
      );
      throw new Error(
        "No questions available for the selected difficulty level"
      );
    }

    const [record1, record2] = await Promise.all([
      ExamRecord.findOne({ studentId: student1.student_id }).select(
        "answeredQuestions"
      ),
      ExamRecord.findOne({ studentId: student2.student_id }).select(
        "answeredQuestions"
      ),
    ]);
    const answeredQuestionIds = [
      ...(record1?.answeredQuestions || []),
      ...(record2?.answeredQuestions || []),
    ].map((q) => q.toString());

    availableQuestions = availableQuestions.filter(
      (q) => !answeredQuestionIds.includes(q._id.toString())
    );

    if (availableQuestions.length < 10) {
      console.log(
        `❌ Not enough unique questions available after filtering answered ones. Available: ${
          availableQuestions.length
        }, Required: 5, subjectId: ${subjectId}, gradeLevelId: ${gradeLevelId}, difficulty: ${
          Array.isArray(difficulty) ? difficulty.join(", ") : difficulty
        }`
      );
      throw new Error("Not enough unique questions available");
    }

    const selectedQuestions = availableQuestions
      .sort(() => 0.5 - Math.random())
      .slice(0, 10);
    const questionsData = selectedQuestions.map((q) => ({
      questionId: q._id,
      questionText: q.questionText,
      options: q.options,
      marks: q.marks,
      correctAnswer: q.correctAnswer,
    }));

    const exam = new Exam({
      questions: questionsData,
      duration: 20,
      studentIds: studentIds,
    });
    await exam.save();
    const examId = exam._id;

    const examRecords = studentIds.map((studentId) => ({
      examId: examId,
      studentId: studentId,
      score: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await ExamRecord.insertMany(examRecords);

    return { examId, duration: 20, questions: questionsData };
  } catch (error) {
    console.error(`❌ Error starting exam in examService: ${error.message}`);
    throw error;
  }
}

router.get("/update-ranks", async (req, res) => {
  try {
    await updateRanks();
    const ranks = await Rank.find().lean();
    res.status(200).json({
      message: "Ranks retrieved successfully!",
      ranks,
    });
  } catch (error) {
    console.error("❌ Error updating ranks:", error.message);
    res
      .status(500)
      .json({ message: "Error updating ranks.", error: error.message });
  }
});

router.post("/submit-answers", async (req, res) => {
  const { examId, studentId: rawStudentId, answers } = req.body;

  console.log("🎯 Running submit-answers");
  console.log("📥 Received:", { examId, studentId: rawStudentId });

  const studentId = Number(rawStudentId);
  console.log("🚀 Submitting for student:", studentId, "exam:", examId);

  try {
    console.log("🔍 Calculating score...");
    const { totalScore, responseDetails } = await calculateScore(
      examId,
      studentId,
      answers
    );
    console.log("Response details:", responseDetails);
    console.log("✅ Score:", totalScore);

    console.log("🔍 Looking for exam record...");
    const examRecord = await ExamRecord.findOne({ examId, studentId });
    if (examRecord) {
      examRecord.score = totalScore;
      examRecord.updatedAt = new Date();
      await examRecord.save();
      console.log("📝 Updated exam record:", totalScore);
    } else {
      console.log("⚠️ Exam record not found:", studentId, examId);
    }

    console.log("🔍 Looking for point record:", studentId);
    let point = await Point.findOne({ studentId });
    if (!point) {
      console.log("🆕 Creating new point entry:", studentId);
      point = new Point({ studentId, totalPoints: 0 });
    }
    point.totalPoints += totalScore;
    await point.save();
    console.log("💾 Updated points:", point.totalPoints);

    console.log("🔜 Updating ranks...");
    await updateRanks();
    console.log("🔄 Ranks updated");

    res.status(200).json({
      type: "exam_results",
      examId,
      score: totalScore,
      message: "Exam completed! Your score is " + totalScore,
      questions: responseDetails,
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    res
      .status(500)
      .json({ message: "Error submitting answers.", error: error.message });
  }
});

export default router;
