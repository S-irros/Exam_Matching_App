import axios from "axios";
import Question from "../models/questionModel.js";
import Exam from "../models/examModel.js";
import ExamRecord from "../models/examRecordModel.js";
import Point from "../models/pointModel.js";
import StudentAnswer from "../models/studentAnswerModel.js";

export async function startExam(student1, student2) {
  try {
    const studentIds = [student1.student_id, student2.student_id];
    const subjectId = student1.subjectId;
    const gradeLevelId = student1.gradeLevelId;

    const response = await axios.post("http://localhost:8080/api/exams/start-exam", {
      studentIds,
      subjectId,
      gradeLevelId,
    });

    const { examId, questions, duration } = response.data;

    if (!examId || !Array.isArray(questions) || !duration) {
      throw new Error("Invalid exam data received from API");
    }

    // ترجع البيانات بس من غير إرسال الـ response
    return { examId, duration, questions };
  } catch (error) {
    console.error("❌ Error starting exam in examService:", error.message);
    throw error;
  }
}

export async function calculateScore(examId, studentId, answers) {
  const exam = await Exam.findById(examId);
  if (!exam) throw new Error("Exam not found");

  const examQuestions = exam.questions;
  const questionMap = new Map(examQuestions.map((q) => [q.questionId.toString(), q]));

  let totalScore = 0;
  const studentAnswers = [];

  // جيب كل الأسئلة مرة واحدة عشان الأداء
  const questionIds = answers.map((answer) => answer.questionId);
  const questions = await Question.find({ _id: { $in: questionIds } }).select("correctAnswer marks");

  // اعمل ماب للـ questionId مع الـ correctAnswer و marks
  const questionDetailsMap = new Map(
    questions.map((q) => [q._id.toString(), { correctAnswer: q.correctAnswer, marks: q.marks || 5 }])
  );

  for (const answer of answers) {
    const questionId = answer.questionId;
    const userAnswer = answer.selectedAnswer;

    const question = questionMap.get(questionId.toString());
    if (!question) continue; // لو السؤال مش في الإمتحان، اتجاهله

    const questionDetails = questionDetailsMap.get(questionId.toString());
    if (!questionDetails) continue; // لو السؤال مش موجود في الـ Question موديل، اتجاهله

    const isCorrect = userAnswer === questionDetails.correctAnswer;
    const marks = questionDetails.marks;
    const score = isCorrect ? marks : 0;

    totalScore += score;

    studentAnswers.push({
      studentId,
      examId,
      questionId,
      answer: userAnswer,
      isCorrect,
      score,
      marks,
      createdAt: new Date(),
    });
  }

  await StudentAnswer.insertMany(studentAnswers);
  return totalScore;
}