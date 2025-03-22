// websocket/websocketHandler.js
import { startExam, calculateScore } from "../services/examService.js";
import verifyToken from "../services/authService.js";
import User from "../models/User.model.js";
import ExamRecord from "../models/examRecordModel.js";
import Exam from "../models/examModel.js";

// تعريف قيم WebSocket readyState يدويًا
const READY_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

const verifiedUsers = new Map();
const activeStudents = [];

function findMatch(student) {
  return activeStudents.find(other =>
    other.email !== student.email &&
    other.subjectId === student.subjectId &&
    other.gradeLevelId === student.gradeLevelId &&
    (student.preferred_gender_id === 0 || other.genderId === student.preferred_gender_id) &&
    (other.preferred_gender_id === 0 || student.genderId === other.preferred_gender_id)
  );
}

function removeStudentFromQueue(email) {
  const index = activeStudents.findIndex(student => student.email === email);
  if (index !== -1) activeStudents.splice(index, 1);
}

export default function setupWebSocket(wss) {
  wss.on("connection", (ws) => {
    console.log("🟢 New WebSocket connection");

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message);

        if (data.type === "verify_login") {
          const { email, token } = data;
          try {
            const user = await verifyToken(email, token);
            verifiedUsers.set(email, user);
            ws.user = user;
            ws.send(JSON.stringify({ message: "✅ Login verified", user: user.name }));
            console.log("✅ Verified login for:", email, "with student_id:", user.student_id);
          } catch (err) {
            ws.send(JSON.stringify({ message: "❌ Login failed", error: err.message }));
            console.log("❌ Login failed for:", email);
          }
          return;
        }

        if (data.type === "match_request") {
          const { email, subjectId, preferred_gender_id, gradeLevelId } = data;
          let user = verifiedUsers.get(email) || ws.user;
          if (!user) {
            if (ws.readyState === READY_STATES.OPEN) ws.send(JSON.stringify({ message: "❌ Unauthorized request" }));
            return;
          }

          const studentData = {
            ws,
            email: user.email,
            student_id: user.randomId,
            subjectId: Number(subjectId),
            gradeLevelId: Number(gradeLevelId),
            genderId: user.genderId,
            preferred_gender_id: Number(preferred_gender_id),
          };

          activeStudents.push(studentData);
          const match = findMatch(studentData);
          if (match) {
            console.log(`✅ Match found between ${email} and ${match.email}`);
            await startExam(studentData, match);
            removeStudentFromQueue(email);
            removeStudentFromQueue(match.email);
            if (studentData.ws.readyState === READY_STATES.OPEN) studentData.ws.send(JSON.stringify({ message: "⏳ Starting the exam..." }));
            if (match.ws.readyState === READY_STATES.OPEN) match.ws.send(JSON.stringify({ message: "⏳ Starting the exam..." }));
          } else {
            if (ws.readyState === READY_STATES.OPEN) ws.send(JSON.stringify({ message: "🔍 Waiting for match..." }));
          }
        }

        if (data.type === "submit_answers") {
          const { examId, studentId, answers, email } = data;
          if (!examId || !studentId || !answers || !Array.isArray(answers) || !email) {
            if (ws.readyState === READY_STATES.OPEN) ws.send(JSON.stringify({ message: "❌ Invalid answers format: Missing examId, studentId, answers, or email" }));
            return;
          }

          let user = verifiedUsers.get(email) || (await User.findOne({ email })?.toObject());
          if (!user) {
            if (ws.readyState === READY_STATES.OPEN) ws.send(JSON.stringify({ message: "❌ Unauthorized: Please verify login first" }));
            console.log(`❌ Unauthorized attempt to submit answers by student ${studentId} (email: ${email})`);
            return;
          }
          if (user.student_id !== studentId) {
            if (ws.readyState === READY_STATES.OPEN) ws.send(JSON.stringify({ message: "❌ Unauthorized: Student ID does not match verified user" }));
            console.log(`❌ Student ID mismatch: ${studentId} does not match verified user ${user.student_id} (email: ${email})`);
            return;
          }

          const userExists = await User.findOne({ randomId: studentId });
          if (!userExists) {
            if (ws.readyState === READY_STATES.OPEN) ws.send(JSON.stringify({ message: "❌ User not found in the database" }));
            console.log(`❌ User ${studentId} not found in users table`);
            return;
          }

          const examRecord = await ExamRecord.findOne({ examId, studentId });
          if (!examRecord) {
            if (ws.readyState === READY_STATES.OPEN) ws.send(JSON.stringify({ message: "❌ Unauthorized: You did not participate in this exam" }));
            console.log(`❌ User ${studentId} did not participate in exam ${examId}`);
            return;
          }

          const existingRecord = await ExamRecord.findOne({ examId, studentId, score: { $gt: 0 } });
          if (existingRecord) {
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(JSON.stringify({
                type: "exam_results",
                examId,
                score: existingRecord.score,
                message: "لقد أجبت على هذا الإمتحان من قبل! درجتك السابقة محفوظة.",
              }));
            }
            console.log(`⚠️ User ${studentId} already submitted exam ${examId}`);
            return;
          }

          const exam = await Exam.findById(examId);
          if (!exam || !exam.questions || exam.questions.length === 0) {
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(JSON.stringify({
                type: "exam_results",
                examId,
                score: 0,
                message: "❌ لا يوجد أسئلة مرتبطة بهذا الإمتحان.",
              }));
            }
            console.log(`❌ No questions found for exam ${examId}`);
            return;
          }

          console.log(`📝 Received answers from user ${studentId} for exam ${examId}`);
          const score = await calculateScore(examId, studentId, answers);
          await ExamRecord.updateOne({ examId, studentId }, { $set: { score, updatedAt: new Date() } });

          if (ws.readyState === READY_STATES.OPEN) {
            ws.send(JSON.stringify({
              type: "exam_results",
              examId,
              score,
              message: `Exam completed! Your score is ${score}`,
            }));
          }
          console.log(`✅ Score calculated for user ${studentId}: ${score}`);
        }
      } catch (err) {
        console.error("❌ Error handling message:", err.message);
        if (ws.readyState === READY_STATES.OPEN) ws.send(JSON.stringify({ message: "❌ Invalid request format" }));
      }
    });

    ws.on("close", () => {
      if (ws.user) {
        removeStudentFromQueue(ws.user.email);
        console.log(`${ws.user.email} disconnected and removed from queue`);
      }
    });
  });
}