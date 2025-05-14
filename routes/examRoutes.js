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
    const users = await User.find({ randomId: { $in: points.map(p => p.studentId) } }).lean();
    console.log("👥 Users found:", users.length, users);

    const userMap = new Map(users.map(u => [u.randomId, u.name]));
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
    console.error("❌ Error updating ranks in updateRanks:", error.message, error.stack);
    throw error;
  }
};

router.post("/start-exam", async (req, res) => {
  const { studentIds, subjectId, gradeLevelId } = req.body;
  console.log("🚀 Received exam start request:", req.body);

  if (
    !Array.isArray(studentIds) ||
    studentIds.length !== 2 ||
    !subjectId ||
    !gradeLevelId
  ) {
    return res
      .status(400)
      .json({
        message:
          "Invalid input. Ensure you provide two student IDs, a subject ID, and a grade level ID.",
      });
  }

  try {
    const students = await User.find({ randomId: { $in: studentIds } });
    if (students.length !== 2)
      throw new Error("One or both students do not exist.");

    const studentScores = await Promise.all(
      studentIds.map(async (studentId) => {
        const points = await Point.findOne({ studentId });
        return { studentId, score: points ? points.totalPoints : 0 };
      })
    );

    const averageScore =
      studentScores.reduce((sum, student) => sum + student.score, 0) /
      studentScores.length;
    let difficultyLevel =
      averageScore <= 350 ? "easy" : averageScore <= 700 ? "medium" : "hard";
    console.log(
      `📊 Average score: ${averageScore}, Difficulty Level: ${difficultyLevel}`
    );

    const answeredQuestions = await StudentAnswer.find({
      studentId: { $in: studentIds },
    }).distinct("questionId");
    let questions = await Question.find({
      subjectId: Number(subjectId),
      gradeLevelId: Number(gradeLevelId),
      difficultyLevel,
      _id: { $nin: answeredQuestions },
    }).limit(10);

    console.log(
      `🔍 Found new questions (difficulty: ${difficultyLevel}):`,
      questions.length
    );

    const uniqueQuestions = Array.from(
      new Map(questions.map((q) => [q._id.toString(), q])).values()
    );
    questions = uniqueQuestions;

    if (questions.length === 0) {
      throw new Error(
        `No ${difficultyLevel} questions available for the given subject and grade level.`
      );
    }

    const examQuestions = questions.map((q) => ({
      questionId: q._id,
      questionText: q.questionText,
      options: q.options,
      marks: q.marks || 5,
    }));

    const exam = new Exam({
      questions: examQuestions,
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

    const studentEmails = students
      .map((student) => student.email)
      .join(" and ");
    console.log(
      `📚 Exam started for ${studentEmails} with ${examQuestions.length} questions`
    );

    res.status(201).json({
      message: `Exam started successfully for students (${studentIds[0]}, ${studentIds[1]})!`,
      examId: examId.toString(),
      duration: 20,
      questions: examQuestions,
      difficultyLevel,
    });
  } catch (error) {
    console.error("❌ Error starting the exam:", error.message);
    res
      .status(500)
      .json({ message: "Error starting the exam.", error: error.message });
  }
});

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

  console.log("🎯 Running submit-answers from examRoutes.js");
  console.log("📥 Received submit-answers request:", { examId, studentId: rawStudentId, answers });

  const studentId = Number(rawStudentId);
  console.log("🚀 Submitting answers for student:", studentId, "exam:", examId);

  try {
    console.log("🔍 Calculating score...");
    const totalScore = await calculateScore(examId, studentId, answers);
    console.log("✅ Calculated score:", totalScore);

    console.log("🔍 Looking for exam record...");
    const examRecord = await ExamRecord.findOne({ examId, studentId });
    if (examRecord) {
      examRecord.score = totalScore;
      examRecord.updatedAt = new Date();
      try {
        await examRecord.save();
        console.log("📝 Updated exam record with score:", totalScore);
      } catch (error) {
        console.error("❌ Error saving exam record:", error.message, error.stack);
        throw error;
      }
    } else {
      console.log("⚠️ Exam record not found for student:", studentId, "exam:", examId);
    }

    console.log("🔍 Looking for point record with studentId:", studentId);
    let point = await Point.findOne({ studentId });
    if (!point) {
      console.log("🆕 Creating new point entry for student:", studentId);
      point = new Point({ studentId, totalPoints: 0 });
    } else {
      console.log("📍 Found existing point:", point);
    }
    point.totalPoints += totalScore;
    try {
      await point.save();
      console.log("💾 Updated points for student:", studentId, "New totalPoints:", point.totalPoints);
    } catch (error) {
      console.error("❌ Error saving point:", error.message, error.stack);
      throw error;
    }

    console.log("🔜 Updating ranks...");
    await updateRanks();
    console.log("🔄 Ranks updated after submission for student:", studentId);

    res.status(200).json({
      message: "Exam completed! Your score is " + totalScore,
      examId,
      score: totalScore,
    });
  } catch (error) {
    console.error("❌ Error submitting answers:", error.message, error.stack);
    res.status(500).json({ message: "Error submitting answers.", error: error.message });
  }
});

export default router;
