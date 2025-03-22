// services/examService.js
import axios from "axios";
import Exam from "../models/examModel.js";
import ExamRecord from "../models/examRecordModel.js";
import Question from "../models/questionModel.js";
import StudentAnswer from "../models/studentAnswerModel.js";
import Point from "../models/pointModel.js";
import updateTotalPoints from "./pointService.js";

// تعريف قيم WebSocket readyState يدويًا
const READY_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

async function startExam(student, match) {
  try {
    console.log("📡 Starting exam request for:", student.email, "and", match.email);
    const studentIds = [student.student_id, match.student_id];
    const response = await axios.post("http://localhost:8080/api/exams/start-exam", {
      studentIds,
      subjectId: student.subjectId,
      gradeLevelId: student.gradeLevelId,
    });
    let { examId, duration, questions } = response.data;

    if (!questions || questions.length === 0) {
      console.log(`⚠️ No questions found for exam ${examId}, generating new ones...`);
      const answeredQuestions = await StudentAnswer.find({ studentId: student.student_id }).distinct("questionId");
      let newQuestions = await Question.find({
        subjectId: student.subjectId,
        gradeLevelId: student.gradeLevelId,
        _id: { $nin: answeredQuestions },
      }).lean(); // استخدام .lean() لتحسين الأداء وجلب الداتا كـ object

      console.log("🔍 Found raw questions for student:", newQuestions.length);

      // إزالة التكرار بناءً على _id
      const uniqueQuestions = Array.from(
        new Map(newQuestions.map(q => [q._id.toString(), q])).values()
      );
      newQuestions = uniqueQuestions;

      // لو مفيش أسئلة متاحة، نرمي خطأ
      if (newQuestions.length === 0) {
        throw new Error("No questions available to generate for this exam.");
      }

      // تحويل الأسئلة للصيغة المطلوبة
      questions = newQuestions.map(q => ({
        questionId: q._id,
        questionText: q.questionText,
        options: q.options,
        marks: q.marks || 5, // افتراض إن الـ marks 5 لو مفيش قيمة
      }));

      // تحديث الامتحان بالأسئلة الفريدة
      await Exam.updateOne(
        { _id: examId },
        { $set: { questions: questions } },
        { upsert: true }
      );
    }

    for (const s of [student, match]) {
      await ExamRecord.updateOne(
        { examId, studentId: s.student_id },
        { $set: { score: 0, createdAt: new Date(), updatedAt: new Date() } },
        { upsert: true }
      );
    }

    [student, match].forEach(s => {
      if (s.ws && s.ws.readyState === READY_STATES.OPEN) {
        s.ws.examId = examId;
        s.ws.verified = true;
        s.ws.send(JSON.stringify({ type: "exam_started", examId, duration, questions }));
      }
    });
    console.log(`📚 Exam started for ${student.email} and ${match.email} with ${questions.length} questions`);
  } catch (err) {
    console.error("❌ Failed to start exam:", err.message);
    [student, match].forEach(s => {
      if (s && s.ws && s.ws.readyState === READY_STATES.OPEN) {
        s.ws.send(JSON.stringify({ type: "error", message: `Failed to start the exam: ${err.message}` }));
      }
    });
  }
}

async function calculateScore(examId, studentId, answers) {
  try {
    const exam = await Exam.findById(examId);
    if (!exam) throw new Error("Exam not found");

    let totalScore = 0;
    const answerRecords = [];

    for (let answer of answers) {
      const question = exam.questions.find(q => q.questionId.toString() === answer.questionId.toString());
      const fullQuestion = await Question.findById(question.questionId);
      let points = 0;
      if (fullQuestion && answer.selectedAnswer === fullQuestion.correctAnswer) {
        points = question.marks;
        totalScore += points;
      }
      answerRecords.push({ examId, studentId, questionId: question.questionId, answer: answer.selectedAnswer, points });
    }

    if (answerRecords.length > 0) await StudentAnswer.insertMany(answerRecords);
    await ExamRecord.updateOne({ examId, studentId }, { $set: { score: totalScore, updatedAt: new Date() } });
    await updateTotalPoints(studentId, totalScore);
    await axios.post("http://localhost:8080/api/update-ranks");
    return totalScore;
  } catch (err) {
    console.error("❌ Error calculating score:", err.message);
    throw err;
  }
}

export { startExam, calculateScore };