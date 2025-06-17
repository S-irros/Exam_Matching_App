import axios from "axios";
import Question from "../models/questionModel.js";
import Exam from "../models/examModel.js";
import ExamRecord from "../models/examRecordModel.js";
import Point from "../models/pointModel.js";
import StudentAnswer from "../models/studentAnswerModel.js";
import User from "../models/User.model.js";

export async function startExam(student1, student2) {
  try {
    const studentIds = [student1.student_id, student2.student_id];
    const subjectId = student1.subjectId;
    const gradeLevelId = student1.gradeLevelId;

    // جلب totalPoints لكل طالب
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

    // جلب الأسئلة مع correctAnswer
    const allQuestions = await Question.find({
      subjectId,
      gradeLevelId,
    }).select("_id questionText options marks difficultyLevel correctAnswer");

    if (allQuestions.length === 0) {
      console.log(`❌ No questions found in database for subjectId: ${subjectId}, gradeLevelId: ${gradeLevelId}`);
      throw new Error("No questions found in database");
    }

    let availableQuestions = allQuestions.filter((q) =>
      Array.isArray(difficulty)
        ? difficulty.includes(q.difficultyLevel)
        : q.difficultyLevel === difficulty
    );

    if (availableQuestions.length === 0) {
      console.log(`⚠️ No questions available for difficulty level: ${Array.isArray(difficulty) ? difficulty.join(", ") : difficulty} with subjectId: ${subjectId}, gradeLevelId: ${gradeLevelId}`);
      throw new Error("No questions available for the selected difficulty level");
    }

    const [record1, record2] = await Promise.all([
      ExamRecord.findOne({ studentId: student1.student_id }).select("answeredQuestions"),
      ExamRecord.findOne({ studentId: student2.student_id }).select("answeredQuestions"),
    ]);
    const answeredQuestionIds = [
      ...(record1?.answeredQuestions || []),
      ...(record2?.answeredQuestions || []),
    ].map((q) => q.toString());

    availableQuestions = availableQuestions.filter(
      (q) => !answeredQuestionIds.includes(q._id.toString())
    );

    if (availableQuestions.length < 10) {
      console.log(`❌ Not enough unique questions available after filtering answered ones. Available: ${availableQuestions.length}, Required: 5, subjectId: ${subjectId}, gradeLevelId: ${gradeLevelId}, difficulty: ${Array.isArray(difficulty) ? difficulty.join(", ") : difficulty}`);
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

    await Promise.all([
      ExamRecord.findOneAndUpdate(
        { studentId: student1.student_id },
        { $addToSet: { answeredQuestions: { $each: selectedQuestions.map((q) => q._id) } } },
        { upsert: true, new: true }
      ),
      ExamRecord.findOneAndUpdate(
        { studentId: student2.student_id },
        { $addToSet: { answeredQuestions: { $each: selectedQuestions.map((q) => q._id) } } },
        { upsert: true, new: true }
      ),
    ]);

    return { examId, duration: 20, questions: questionsData };
  } catch (error) {
    console.error(`❌ Error starting exam in examService: ${error.message}`);
    throw error;
  }
}

export async function calculateScore(examId, studentId, answers) {
  const exam = await Exam.findById(examId);
  if (!exam) throw new Error("Exam not found");

  const questionIds = answers.map((answer) => answer.questionId);
  const questions = await Question.find({ _id: { $in: questionIds } }).select(
    "correctAnswer marks questionText"
  );

  const questionDetailsMap = new Map(
    questions.map((q) => [
      q._id.toString(),
      {
        correctAnswer: q.correctAnswer,
        marks: q.marks || 5,
        questionText: q.questionText,
      },
    ])
  );

  let totalScore = 0;
  const studentAnswers = [];
  const responseDetails = [];

  for (const answer of answers) {
    const questionId = answer.questionId;
    const userAnswer = answer.selectedAnswer;

    const questionDetails = questionDetailsMap.get(questionId.toString());
    if (!questionDetails) continue;

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

    const questionResponse = {
      questionText: questionDetails.questionText,
      selectedAnswer: userAnswer,
      correctAnswer: questionDetails.correctAnswer,
      isCorrect,
    };
    responseDetails.push(questionResponse);
  }

  await StudentAnswer.insertMany(studentAnswers);
  return { totalScore, responseDetails, message: `Exam completed! Your score is ${totalScore}` };
}