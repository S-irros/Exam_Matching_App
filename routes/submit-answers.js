// const express = require('express');
// const router = express.Router();
// const ExamRecord = require('../models/examRecordModel.js');
// const Point = require('../models/pointModel.js');
// const { calculateScore } = require("../services/examService.js");

// router.post("/submit-answers", async (req, res) => {
//   const { examId, studentId, answers } = req.body;

//   try {
//     const totalScore = await calculateScore(examId, studentId, answers);

//     const examRecord = await ExamRecord.findOne({ examId, studentId });
//     if (examRecord) {
//       examRecord.score = totalScore;
//       examRecord.updatedAt = new Date();
//       await examRecord.save();
//     }

//     let point = await Point.findOne({ studentId });
//     if (!point) {
//       point = new Point({ studentId, totalPoints: 0 });
//     }
//     point.totalPoints += totalScore;
//     await point.save();

//     res.status(200).json({
//       message: "Exam completed! Your score is " + totalScore,
//       examId,
//       score: totalScore,
//     });
//   } catch (error) {
//     console.error("❌ Error submitting answers:", error.message);
//     res.status(500).json({ message: "Error submitting answers.", error: error.message });
//   }
// });

// module.exports = router;