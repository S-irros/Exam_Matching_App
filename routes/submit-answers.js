const express = require('express');
const router = express.Router();
const Question = require('../model/question');
const ExamRecord = require('../model/examRecord');
const Result = require('../model/result');
const Student = require('../model/student');

router.post('/submit-answers', async (req, res) => {
  const { studentId, examRecordId, answers } = req.body;

  try {
   
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

   
    const examRecord = await ExamRecord.findById(examRecordId);
    if (!examRecord) {
      return res.status(404).json({ message: 'Exam record not found.' });
    }

    console.log('Exam Record:', examRecord); 

    
    const questions = await Question.find({ _id: { $in: examRecord.questionIds } });

    
    let correctAnswersCount = 0;
    const detailedResults = questions.map((question) => {
      const studentAnswer = answers.find(ans => ans.questionId === question._id.toString());
      const isCorrect = studentAnswer && studentAnswer.selectedAnswer === question.correctAnswer;

      if (isCorrect) correctAnswersCount++;

      return {
        questionText: question.questionText,
        correctAnswer: question.correctAnswer,
        studentAnswer: studentAnswer ? studentAnswer.selectedAnswer : 'No Answer',
        isCorrect
      };
    });

    const score = correctAnswersCount * 5;

   
    const result = new Result({
      studentId,
      examId: examRecord.examId,      
      examRecordId: examRecord._id,
      score,
      totalQuestions: questions.length
    });
    await result.save();

    
    student.totalScore += score;
    await student.save();

    res.json({
      message: 'Answers submitted successfully!',
      score,
      totalScore: student.totalScore,
      totalQuestions: questions.length,
      correctAnswers: correctAnswersCount,
      details: detailedResults
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error submitting answers.', error: error.message });
  }
});

module.exports = router;
