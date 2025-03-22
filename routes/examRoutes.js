// routes/examRoutes.js
import express from "express";
import mongoose from "mongoose";
import User from "../models/User.model.js";
import Exam from "../models/examModel.js";
import ExamRecord from "../models/examRecordModel.js";
import Question from "../models/questionModel.js";
import Point from "../models/pointModel.js";
import StudentAnswer from "../models/studentAnswerModel.js";

const router = express.Router();

router.post("/start-exam", async (req, res) => {
  const { studentIds, subjectId, gradeLevelId } = req.body;
  console.log("🚀 Received exam start request:", req.body);

  if (!Array.isArray(studentIds) || studentIds.length !== 2 || !subjectId || !gradeLevelId) {
    return res.status(400).json({ message: "Invalid input. Ensure you provide two student IDs, a subject ID, and a grade level ID." });
  }

  try {
    const students = await User.find({ randomId: { $in: studentIds } });
    if (students.length !== 2) throw new Error("One or both students do not exist.");

    const studentScores = await Promise.all(
      studentIds.map(async (studentId) => {
        const points = await Point.findOne({ studentId });
        return { studentId, score: points ? points.totalPoints : 0 };
      })
    );

    const averageScore = studentScores.reduce((sum, student) => sum + student.score, 0) / studentScores.length;
    let difficultyLevel = averageScore <= 350 ? "easy" : averageScore <= 700 ? "medium" : "hard";
    console.log(`📊 Average score: ${averageScore}, Difficulty Level: ${difficultyLevel}`);

    const answeredQuestions = await StudentAnswer.find({ studentId: { $in: studentIds } }).distinct("questionId");
    let questions = await Question.find({
      subjectId: Number(subjectId),
      gradeLevelId: Number(gradeLevelId),
      difficultyLevel,
      _id: { $nin: answeredQuestions },
    }).limit(10);

    console.log(`🔍 Found new questions (difficulty: ${difficultyLevel}):`, questions.length);

    const uniqueQuestions = Array.from(
      new Map(questions.map(q => [q._id.toString(), q])).values()
    );
    questions = uniqueQuestions;

    if (questions.length === 0) {
      throw new Error(`No ${difficultyLevel} questions available for the given subject and grade level.`);
    }

    const examQuestions = questions.map((q) => ({
      questionId: q._id,
      questionText: q.questionText,
      options: q.options,
      marks: q.marks || 5,
    }));

    const exam = new Exam({ questions: examQuestions, duration: 20 });
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

    res.status(201).json({
      message: `Exam started successfully for students (${studentIds[0]}, ${studentIds[1]})!`,
      examId: examId.toString(),
      duration: 20,
      questions: examQuestions,
      difficultyLevel,
    });
  } catch (error) {
    console.error("❌ Error starting the exam:", error.message);
    res.status(500).json({ message: "Error starting the exam.", error: error.message });
  }
});

router.get("/update-ranks", async (req, res) => {
  try {
    const points = await Point.find().sort({ totalPoints: -1 }).lean();
    const users = await User.find({ randomId: { $in: points.map(p => p.studentId) } }).lean();
    const userMap = new Map(users.map(u => [u.randomId, u.name]));

    const ranks = points.map((point, index) => ({
      ...point,
      name: userMap.get(point.studentId) || "Unknown",
      rank: index + 1,
    }));

    res.status(200).json({
      message: "Ranks retrieved successfully!",
      ranks,
    });
  } catch (error) {
    console.error("❌ Error updating ranks:", error.message);
    res.status(500).json({ message: "Error updating ranks.", error: error.message });
  }
});

router.post("/submit-answers", async (req, res) => {
  const { examId, studentId, answers } = req.body;
  console.log("🚀 Received submit answers request:", req.body);

  if (!examId || !studentId || !Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ message: "Invalid input. Ensure examId, studentId, and answers are provided." });
  }

  try {
    const exam = await Exam.findById(examId);
    if (!exam) throw new Error("Exam not found.");

    const examQuestions = exam.questions;
    const questionMap = new Map(examQuestions.map(q => [q.questionId.toString(), q]));

    let totalScore = 0;
    const studentAnswers = [];

    for (const answer of answers) {
      const questionId = answer.questionId;
      const userAnswer = answer.answer;

      const question = await Question.findById(questionId);
      if (!question) continue;

      const isCorrect = userAnswer === question.correctAnswer;
      const marks = question.marks || 5;

      totalScore += isCorrect ? marks : 0;

      studentAnswers.push({
        studentId,
        questionId,
        answer: userAnswer,
        isCorrect,
        marks,
        createdAt: new Date(),
      });
    }

    await StudentAnswer.insertMany(studentAnswers);

    const examRecord = await ExamRecord.findOne({ examId, studentId });
    if (examRecord) {
      examRecord.score = totalScore;
      examRecord.updatedAt = new Date();
      await examRecord.save();
    }

    let point = await Point.findOne({ studentId });
    if (!point) {
      point = new Point({ studentId, totalPoints: 0 });
    }
    point.totalPoints += totalScore;
    await point.save();

    res.status(200).json({
      message: "Exam completed! Your score is " + totalScore,
      examId,
      score: totalScore,
    });
  } catch (error) {
    console.error("❌ Error submitting answers:", error.message);
    res.status(500).json({ message: "Error submitting answers.", error: error.message });
  }
});

export default router;