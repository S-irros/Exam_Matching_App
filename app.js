// import express from "express";
// import http from "http";
// import WebSocket, { WebSocketServer } from 'ws';
// import axios from "axios";
// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import User from "./models/User.model.js";
// import Question from "./models/questionModel.js";
// import Exam from "./models/examModel.js";
// import ExamRecord from "./models/examRecordModel.js";
// import StudentAnswer from "./models/studentAnswerModel.js";
// import Point from "./models/pointModel.js";
// import jwt from "jsonwebtoken";
// import gradeLevelRoutes from "./routes/gradeLevelRoutes.js";
// import subjectRoutes from "./routes/subjectRoutes.js";
// import rankRoutes from "./routes/rankRoutes.js";
// import cron from "node-cron";

// dotenv.config();

// const app = express();
// const server = http.createServer(app);
// const wss = new WebSocketServer({ server });

// app.use(express.json());

// app.use("/api/grade-levels", gradeLevelRoutes);
// app.use("/api/subjects", subjectRoutes);
// app.use("/api", rankRoutes);

// cron.schedule("0 * * * *", async () => {
//   console.log("⏰ Scheduled rank update started at:", new Date());
//   try {
//     await axios.post("http://localhost:8080/api/update-ranks");
//     console.log("✅ Rank update completed successfully!");
//   } catch (error) {
//     console.error("❌ Error in scheduled rank update:", error.message);
//   }
// });


// app.post("/api/start-exam", async (req, res) => {
//   const { studentIds, subjectId, gradeLevelId } = req.body;

//   console.log("🚀 Received exam start request:", req.body);

//   if (!Array.isArray(studentIds) || studentIds.length !== 2 || !subjectId || !gradeLevelId) {
//     return res.status(400).json({
//       message: "Invalid input. Ensure you provide two student IDs, a subject ID, and a grade level ID.",
//     });
//   }

//   try {
//     const students = await User.find({ randomId: { $in: studentIds } });
//     if (students.length !== 2) {
//       throw new Error("One or both students do not exist.");
//     }

//     // جلب الـ score بتاع كل طالب
//     const studentScores = await Promise.all(
//       studentIds.map(async (studentId) => {
//         const points = await Point.findOne({ studentId });
//         return { studentId, score: points ? points.totalPoints : 0 };
//       })
//     );

//     // تحديد مستوى الصعوبة بناءً على متوسط الـ score بتاع الطالبين
//     const averageScore =
//       studentScores.reduce((sum, student) => sum + student.score, 0) /
//       studentScores.length;
//     let difficultyLevel;
//     if (averageScore <= 350) {
//       difficultyLevel = "easy";
//     } else if (averageScore <= 700) {
//       difficultyLevel = "medium";
//     } else {
//       difficultyLevel = "hard";
//     }

//     console.log(
//       `📊 Average score: ${averageScore}, Difficulty Level: ${difficultyLevel}`
//     );

//     // جلب الأسئلة بناءً على مستوى الصعوبة
//     const answeredQuestions = await StudentAnswer.find({
//       studentId: { $in: studentIds },
//     }).distinct("questionId");

//     let questions = await Question.find({
//       subjectId: Number(subjectId),
//       gradeLevelId: Number(gradeLevelId),
//       difficultyLevel, // فلتر الأسئلة بناءً على مستوى الصعوبة
//       _id: { $nin: answeredQuestions },
//     }).limit(10);

//     console.log(
//       `🔍 Found new questions (difficulty: ${difficultyLevel}):`,
//       questions.length
//     );

//     if (questions.length < 10) {
//       console.warn(
//         `⚠️ Not enough new ${difficultyLevel} questions, recycling older ones...`
//       );
//       const remainingQuestions = await Question.find({
//         subjectId: Number(subjectId),
//         gradeLevelId: Number(gradeLevelId),
//         difficultyLevel,
//       }).limit(10 - questions.length);
//       questions = [...questions, ...remainingQuestions].slice(0, 10);
//       console.log(
//         `🔍 Recycled ${difficultyLevel} questions added, total now:`,
//         questions.length
//       );
//     }

//     if (questions.length === 0) {
//       throw new Error(
//         `No ${difficultyLevel} questions available for the given subject and grade level.`
//       );
//     }

//     const examQuestions = questions.map((q) => ({
//       questionId: q._id,
//       questionText: q.questionText,
//       options: q.options,
//       marks: q.marks,
//     }));

//     const exam = new Exam({
//       questions: examQuestions,
//       duration: 20,
//     });
//     await exam.save();

//     const examId = exam._id;

//     const examRecords = studentIds.map((studentId) => ({
//       examId: examId,
//       studentId: studentId,
//       score: 0,
//       createdAt: new Date(),
//       updatedAt: new Date(),
//     }));
//     await ExamRecord.insertMany(examRecords);

//     res.status(201).json({
//       message: `Exam started successfully for students (${studentIds[0]}, ${studentIds[1]})!`,
//       examId: examId.toString(),
//       duration: 20,
//       questions: examQuestions,
//       difficultyLevel, // بنرجع مستوى الصعوبة في الـ Response عشان نعرف الامتحان كان على أي مستوى
//     });
//   } catch (error) {
//     console.error("❌ Error starting the exam:", error.message);
//     res.status(500).json({ message: "Error starting the exam.", error: error.message });
//   }
// });


// // تعريف الـ Endpoint بتاع إضافة الأسئلة
// app.post("/questions/add-questions", async (req, res) => {
//   const questionsData = req.body;

//   console.log("🚀 Received request to add questions:", questionsData);

//   if (!Array.isArray(questionsData) || questionsData.length === 0) {
//     return res.status(400).json({
//       message: "Invalid input. Please provide an array of questions.",
//     });
//   }

//   try {
//     for (const question of questionsData) {
//       const { questionText, options, correctAnswer, marks, subjectId, gradeLevelId, difficultyLevel } = question;

//       if (!questionText || !options || !Array.isArray(options) || options.length < 2 || !correctAnswer || !marks || !subjectId || !gradeLevelId || !difficultyLevel) {
//         return res.status(400).json({
//           message: "Invalid question format. Each question must have questionText, options (array), correctAnswer, marks, subjectId, gradeLevelId, and difficultyLevel.",
//         });
//       }

//       if (!options.includes(correctAnswer)) {
//         return res.status(400).json({
//           message: `Correct answer "${correctAnswer}" must be one of the provided options: ${options}`,
//         });
//       }

//       if (isNaN(marks) || isNaN(subjectId) || isNaN(gradeLevelId)) {
//         return res.status(400).json({
//           message: "Marks, subjectId, and gradeLevelId must be valid numbers.",
//         });
//       }
//     }

//     const questionsToInsert = questionsData.map(question => ({
//       questionText: question.questionText,
//       options: question.options,
//       correctAnswer: question.correctAnswer,
//       marks: Number(question.marks),
//       subjectId: Number(question.subjectId),
//       gradeLevelId: Number(question.gradeLevelId),
//       difficultyLevel: question.difficultyLevel,
//       createdAt: new Date(),
//       updatedAt: new Date(),
//     }));

//     const insertedQuestions = await Question.insertMany(questionsToInsert);

//     res.status(201).json({
//       message: `Successfully added ${insertedQuestions.length} questions!`,
//       questions: insertedQuestions,
//     });
//   } catch (error) {
//     console.error("❌ Error adding questions:", error.message);
//     res.status(500).json({
//       message: "Error adding questions.",
//       error: error.message,
//     });
//   }
// });

// // تعريف الـ Endpoint بتاع استرجاع الأسئلة
// app.get("/questions", async (req, res) => {
//   const { subjectId, gradeLevelId } = req.query;

//   console.log("🚀 Received request to fetch questions:", { subjectId, gradeLevelId });

//   try {
//     let query = {};

//     if (subjectId) {
//       if (isNaN(subjectId)) {
//         return res.status(400).json({ message: "subjectId must be a valid number." });
//       }
//       query.subjectId = Number(subjectId);
//     }

//     if (gradeLevelId) {
//       if (isNaN(gradeLevelId)) {
//         return res.status(400).json({ message: "gradeLevelId must be a valid number." });
//       }
//       query.gradeLevelId = Number(gradeLevelId);
//     }

//     const questions = await Question.find(query);

//     if (questions.length === 0) {
//       return res.status(404).json({ message: "No questions found for the given criteria." });
//     }

//     res.status(200).json({
//       message: `Successfully retrieved ${questions.length} questions!`,
//       questions,
//     });
//   } catch (error) {
//     console.error("❌ Error retrieving questions:", error.message);
//     res.status(500).json({
//       message: "Error retrieving questions.",
//       error: error.message,
//     });
//   }
// });

// // تعريف الـ Endpoint بتاع تحديث سؤال
// app.put("/questions/update/:id", async (req, res) => {
//   const { id } = req.params;
//   const { questionText, options, correctAnswer, marks, subjectId, gradeLevelId } = req.body;

//   console.log("🚀 Received request to update question:", { id, ...req.body });

//   try {
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({ message: "Invalid question ID format." });
//     }

//     const question = await Question.findById(id);
//     if (!question) {
//       return res.status(404).json({ message: "Question not found." });
//     }

//     if (questionText && typeof questionText !== "string") {
//       return res.status(400).json({ message: "questionText must be a string." });
//     }

//     if (options) {
//       if (!Array.isArray(options) || options.length < 2) {
//         return res.status(400).json({
//           message: "options must be an array with at least 2 options.",
//         });
//       }
//     }

//     if (correctAnswer) {
//       const optionsToCheck = options || question.options;
//       if (!optionsToCheck.includes(correctAnswer)) {
//         return res.status(400).json({
//           message: `Correct answer "${correctAnswer}" must be one of the provided options: ${optionsToCheck}`,
//         });
//       }
//     }

//     if (marks && isNaN(marks)) {
//       return res.status(400).json({ message: "marks must be a valid number." });
//     }

//     if (subjectId && isNaN(subjectId)) {
//       return res.status(400).json({ message: "subjectId must be a valid number." });
//     }

//     if (gradeLevelId && isNaN(gradeLevelId)) {
//       return res.status(400).json({ message: "gradeLevelId must be a valid number." });
//     }

//     const updatedData = {
//       ...(questionText && { questionText }),
//       ...(options && { options }),
//       ...(correctAnswer && { correctAnswer }),
//       ...(marks && { marks: Number(marks) }),
//       ...(subjectId && { subjectId: Number(subjectId) }),
//       ...(gradeLevelId && { gradeLevelId: Number(gradeLevelId) }),
//       updatedAt: new Date(),
//     };

//     const updatedQuestion = await Question.findByIdAndUpdate(id, updatedData, { new: true });

//     res.status(200).json({
//       message: "Question updated successfully!",
//       question: updatedQuestion,
//     });
//   } catch (error) {
//     console.error("❌ Error updating question:", error.message);
//     res.status(500).json({
//       message: "Error updating question.",
//       error: error.message,
//     });
//   }
// });

// // تعريف الـ Endpoint بتاع حذف سؤال
// app.delete("/questions/delete/:id", async (req, res) => {
//   const { id } = req.params;

//   console.log("🚀 Received request to delete question:", { id });

//   try {
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({ message: "Invalid question ID format." });
//     }

//     const question = await Question.findById(id);
//     if (!question) {
//       return res.status(404).json({ message: "Question not found." });
//     }

//     await Question.findByIdAndDelete(id);

//     res.status(200).json({
//       message: "Question deleted successfully!",
//     });
//   } catch (error) {
//     console.error("❌ Error deleting question:", error.message);
//     res.status(500).json({
//       message: "Error deleting question.",
//       error: error.message,
//     });
//   }
// });

// const mongoUrl = process.env.DB;

// async function connectToMongoDB() {
//   try {
//     await mongoose.connect(mongoUrl, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });
//     console.log("✅ MongoDB connected successfully to MongoDB Atlas");
//   } catch (error) {
//     console.error("❌ Error connecting to MongoDB:", error.message);
//     process.exit(1);
//   }
// }

// connectToMongoDB();

// async function verifyToken(email, token) {
//   console.log("Received token:", token);
//   try {
//     const signature = process.env.SIGNATURE;
//     const decoded = jwt.verify(token, signature);
//     console.log("Decoded token:", decoded);
//     if (!decoded?.id || !decoded.email || decoded.email !== email) {
//       throw new Error("Invalid token payload: missing id or email mismatch");
//     }

//     const user = await User.findOne({ email });
//     if (!user) {
//       console.log("User not found in database for email:", email);
//       throw new Error("User not found in database");
//     }
//     if (user.role !== "student") {
//       console.log("User role is not student:", user.role);
//       throw new Error("User is not a student");
//     }

//     return {
//       ...user.toObject(),
//       student_id: user.randomId,
//     };
//   } catch (err) {
//     console.error("❌ Token verification error:", err.message);
//     throw new Error(`Token verification failed: ${err.message}`);
//   }
// }

// const verifiedUsers = new Map();
// const activeStudents = [];

// function findMatch(student) {
//   return activeStudents.find(
//     (other) =>
//       other.email !== student.email &&
//       other.subjectId === student.subjectId &&
//       other.gradeLevelId === student.gradeLevelId &&
//       (student.preferred_gender_id === 0 || other.genderId === student.preferred_gender_id) &&
//       (other.preferred_gender_id === 0 || student.genderId === other.preferred_gender_id)
//   );
// }

// function removeStudentFromQueue(email) {
//   const index = activeStudents.findIndex((student) => student.email === email);
//   if (index !== -1) activeStudents.splice(index, 1);
// }

// async function startExam(student, match) {
//   try {
//     console.log("📡 Starting exam request for:", student.email, "and", match.email);

//     const studentIds = [student.student_id, match.student_id];
//     const response = await axios.post("http://localhost:8080/api/start-exam", {
//       studentIds,
//       subjectId: student.subjectId,
//       gradeLevelId: student.gradeLevelId,
//     });

//     let { examId, duration, questions } = response.data;

//     if (!questions || questions.length === 0) {
//       console.log(`⚠️ No questions found for exam ${examId}, generating new ones...`);

//       const answeredQuestions = await StudentAnswer.find({ studentId: student.student_id })
//         .distinct("questionId");

//       let newQuestions = await Question.find({
//         subjectId: student.subjectId,
//         gradeLevelId: student.gradeLevelId,
//         _id: { $nin: answeredQuestions },
//       }).limit(10);

//       console.log("🔍 Found new questions for student:", newQuestions.length); // للتحقق

//       if (newQuestions.length < 10) {
//         console.warn(`⚠️ Not enough new questions for student ${student.student_id}, recycling older ones...`);
//         const remainingQuestions = await Question.find({
//           subjectId: student.subjectId,
//           gradeLevelId: student.gradeLevelId,
//         }).limit(10 - newQuestions.length);
//         newQuestions = [...newQuestions, ...remainingQuestions].slice(0, 10);
//         console.log("🔍 Recycled questions added, total now:", newQuestions.length);
//       }

//       if (newQuestions.length > 0) {
//         questions = newQuestions.map((q) => ({
//           questionId: q._id,
//           questionText: q.questionText,
//           options: q.options,
//           marks: q.marks,
//         }));

//         await Exam.updateOne(
//           { _id: examId },
//           { $set: { questions: questions.map((q) => ({ ...q, questionId: q.questionId })) } },
//           { upsert: true }
//         );
//       } else {
//         throw new Error("No questions available to generate for this exam.");
//       }
//     }

//     for (const s of [student, match]) {
//       await ExamRecord.updateOne(
//         { examId, studentId: s.student_id },
//         { $set: { score: 0, createdAt: new Date(), updatedAt: new Date() } },
//         { upsert: true }
//       );
//     }

//     [student, match].forEach((s) => {
//       if (s.ws && s.ws.readyState === WebSocket.OPEN) {
//         s.ws.examId = examId;
//         s.ws.verified = true;
//         s.ws.send(
//           JSON.stringify({
//             type: "exam_started",
//             examId,
//             duration,
//             questions,
//           })
//         );
//       }
//     });

//     console.log(`📚 Exam started for ${student.email} and ${match.email} with ${questions.length} questions`);
//   } catch (err) {
//     console.error("❌ Failed to start exam:", err.message);
//     [student, match].forEach((s) => {
//       if (s && s.ws && s.ws.readyState === WebSocket.OPEN) {
//         s.ws.send(JSON.stringify({ type: "error", message: `Failed to start the exam: ${err.message}` }));
//       }
//     });
//   }
// }

// async function updateTotalPoints(studentId, score) {
//   try {
//     const existing = await Point.findOne({ studentId });
//     if (existing) {
//       const newTotal = existing.totalPoints + score;
//       await Point.updateOne({ studentId }, { $set: { totalPoints: newTotal } });
//       console.log(`📊 Total points updated for student ${studentId}: ${newTotal}`);
//     } else {
//       await Point.create({ studentId, totalPoints: score });
//       console.log(`📊 Total points initialized for student ${studentId}: ${score}`);
//     }
//   } catch (err) {
//     console.error("❌ Error updating total points:", err.message);
//     throw err;
//   }
// }

// async function calculateScore(examId, studentId, answers) {
//   try {
//     const exam = await Exam.findById(examId);
//     if (!exam) throw new Error("Exam not found");

//     let totalScore = 0;
//     const answerRecords = [];

//     for (let answer of answers) {
//       const question = exam.questions.find((q) => q.questionId.toString() === answer.questionId.toString());
//       const fullQuestion = await Question.findById(question.questionId);
//       let points = 0;

//       if (fullQuestion) {
//         if (answer.selectedAnswer === fullQuestion.correctAnswer) {
//           points = question.marks;
//           totalScore += points;
//         }

//         answerRecords.push({
//           examId,
//           studentId,
//           questionId: question.questionId,
//           answer: answer.selectedAnswer,
//           points,
//         });
//       }
//     }

//     if (answerRecords.length > 0) {
//       await StudentAnswer.insertMany(answerRecords);
//     }

//     await ExamRecord.updateOne(
//       { examId, studentId },
//       { $set: { score: totalScore, updatedAt: new Date() } }
//     );

//     await updateTotalPoints(studentId, totalScore);

//     await axios.post("http://localhost:8080/api/update-ranks");

//     return totalScore;
//   } catch (err) {
//     console.error("❌ Error calculating score:", err.message);
//     throw err;
//   }
// }

// wss.on("connection", (ws) => {
//   console.log("🟢 New WebSocket connection");

//   ws.on("message", async (message) => {
//     try {
//       const data = JSON.parse(message);

//       if (data.type === "verify_login") {
//         const { email, token } = data;
//         try {
//           const user = await verifyToken(email, token);
//           verifiedUsers.set(email, user);
//           ws.user = user;
//           ws.send(JSON.stringify({ message: "✅ Login verified", user: user.name }));
//           console.log("✅ Verified login for:", email, "with student_id:", user.student_id);
//         } catch (err) {
//           ws.send(JSON.stringify({ message: "❌ Login failed", error: err.message }));
//           console.log("❌ Login failed for:", email);
//         }
//         return;
//       }

//       if (data.type === "match_request") {
//         const { email, subjectId, preferred_gender_id, gradeLevelId } = data;

//         let user = verifiedUsers.get(email);
//         if (!user) {
//           user = ws.user;
//         }
//         if (!user) {
//           ws.send(JSON.stringify({ message: "❌ Unauthorized request" }));
//           return;
//         }

//         const subjectIdNum = Number(subjectId);
//         const preferredGenderIdNum = Number(preferred_gender_id);
//         const gradeLevelIdNum = Number(gradeLevelId);

//         if (isNaN(subjectIdNum) || isNaN(preferredGenderIdNum) || isNaN(gradeLevelIdNum)) {
//           ws.send(JSON.stringify({ message: "❌ Invalid ID format" }));
//           return;
//         }

//         const studentData = {
//           ws,
//           email: user.email,
//           student_id: user.randomId,
//           subjectId: subjectIdNum,
//           gradeLevelId: gradeLevelIdNum,
//           genderId: user.genderId,
//           preferred_gender_id: preferredGenderIdNum,
//         };

//         activeStudents.push(studentData);
//         const match = findMatch(studentData);

//         if (match) {
//           console.log(`✅ Match found between ${email} and ${match.email}`);
//           console.log(`📚 Attempting to start exam for: ${studentData.email} and ${match.email}`);
//           await startExam(studentData, match);
//           removeStudentFromQueue(email);
//           removeStudentFromQueue(match.email);
//           if (studentData.ws.readyState === WebSocket.OPEN)
//             studentData.ws.send(JSON.stringify({ message: "⏳ Starting the exam..." }));
//           if (match.ws.readyState === WebSocket.OPEN)
//             match.ws.send(JSON.stringify({ message: "⏳ Starting the exam..." }));
//         } else {
//           ws.send(JSON.stringify({ message: "🔍 Waiting for match..." }));
//         }
//       }

//       if (data.type === "submit_answers") {
//         const { examId, studentId, answers, email } = data;

//         if (!examId || !studentId || !answers || !Array.isArray(answers) || !email) {
//           ws.send(
//             JSON.stringify({
//               message: "❌ Invalid answers format: Missing examId, studentId, answers, or email",
//             })
//           );
//           return;
//         }

//         let user = verifiedUsers.get(email);
//         if (!user) {
//           const dbUser = await User.findOne({ email });
//           if (!dbUser) {
//             ws.send(JSON.stringify({ message: "❌ Unauthorized: Please verify login first" }));
//             console.log(`❌ Unauthorized attempt to submit answers by student ${studentId} (email: ${email})`);
//             return;
//           }
//           user = { email, student_id: dbUser.randomId, ...dbUser.toObject() };
//           verifiedUsers.set(email, user);
//           console.log(`🔄 Fetched user from DB for email ${email} with student_id: ${user.student_id}`);
//         }

//         const verifiedStudentId = user.student_id;
//         if (verifiedStudentId !== studentId) {
//           ws.send(JSON.stringify({ message: "❌ Unauthorized: Student ID does not match verified user" }));
//           console.log(`❌ Student ID mismatch: ${studentId} does not match verified user ${verifiedStudentId} (email: ${email})`);
//           return;
//         }

//         const userExists = await User.findOne({ randomId: studentId });
//         if (!userExists) {
//           ws.send(JSON.stringify({ message: "❌ User not found in the database" }));
//           console.log(`❌ User ${studentId} not found in users table`);
//           return;
//         }

//         const examRecord = await ExamRecord.findOne({ examId, studentId });
//         if (!examRecord) {
//           ws.send(JSON.stringify({ message: "❌ Unauthorized: You did not participate in this exam" }));
//           console.log(`❌ User ${studentId} did not participate in exam ${examId}`);
//           return;
//         }

//         const existingRecord = await ExamRecord.findOne({ examId, studentId, score: { $gt: 0 } });
//         if (existingRecord) {
//           ws.send(
//             JSON.stringify({
//               type: "exam_results",
//               examId,
//               score: existingRecord.score,
//               message: "لقد أجبت على هذا الإمتحان من قبل! درجتك السابقة محفوظة.",
//             })
//           );
//           console.log(`⚠️ User ${studentId} already submitted exam ${examId}`);
//           return;
//         }

//         const exam = await Exam.findById(examId);
//         if (!exam || !exam.questions || exam.questions.length === 0) {
//           ws.send(
//             JSON.stringify({
//               type: "exam_results",
//               examId,
//               score: 0,
//               message: "❌ لا يوجد أسئلة مرتبطة بهذا الإمتحان.",
//             })
//           );
//           console.log(`❌ No questions found for exam ${examId}`);
//           return;
//         }

//         console.log(`📝 Received answers from user ${studentId} for exam ${examId}`);
//         const score = await calculateScore(examId, studentId, answers);

//         await ExamRecord.updateOne(
//           { examId, studentId },
//           { $set: { score: score, updatedAt: new Date() } }
//         );

//         if (ws.readyState === WebSocket.OPEN) {
//           ws.send(
//             JSON.stringify({
//               type: "exam_results",
//               examId,
//               score,
//               message: `Exam completed! Your score is ${score}`,
//             })
//           );
//         }

//         console.log(`✅ Score calculated for user ${studentId}: ${score}`);
//       }
//     } catch (err) {
//       console.error("❌ Error handling message:", err.message);
//       if (ws.readyState === WebSocket.OPEN) {
//         ws.send(JSON.stringify({ message: "❌ Invalid request format" }));
//       }
//     }
//   });

//   ws.on("close", () => {
//     if (ws.user) {
//       removeStudentFromQueue(ws.user.email);
//       console.log(`${ws.user.email} disconnected and removed from queue`);
//     }
//   });
// });

// server.listen(8080, () => {
//   console.log("🚀 Server running at http://localhost:8080");
// });






































// app.js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import axios from "axios";
import cron from "node-cron";
import connectToMongoDB from "./config/db.js";
import gradeLevelRoutes from "./routes/gradeLevelRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import questionRoutes from "./routes/questionRoutes.js";
import examRoutes from "./routes/examRoutes.js";
import rankRoutes from "./routes/rankRoutes.js";
import setupWebSocket from "./websocket/websocketHandler.js";
import profileRoutes from "./routes/profileRoutes.js";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

app.use("/api/grade-levels", gradeLevelRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/exams", examRoutes);
app.use("/api", rankRoutes);
app.use("/api", profileRoutes);

cron.schedule("0 * * * *", async () => {
  console.log("⏰ Scheduled rank update started at:", new Date());
  try {
    await axios.post("http://localhost:8080/api/update-ranks");
    console.log("✅ Rank update completed successfully!");
  } catch (error) {
    console.error("❌ Error in scheduled rank update:", error.message);
  }
});

connectToMongoDB();

setupWebSocket(wss);

server.listen(8080, () => {
  console.log("🚀 Server running at http://localhost:8080");
});