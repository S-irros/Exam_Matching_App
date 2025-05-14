import { startExam, calculateScore } from "../services/examService.js";
import verifyToken from "../services/authService.js";
import User from "../models/User.model.js";
import ExamRecord from "../models/examRecordModel.js";
import Exam from "../models/examModel.js";
import axios from 'axios';

const READY_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

const verifiedUsers = new Map();
const activeStudents = [];

function removeStudentFromQueue(email) {
  const index = activeStudents.findIndex(student => student.email === email);
  if (index !== -1) {
    activeStudents.splice(index, 1);
    console.log(`Removed ${email} from active students queue`);
  }
}

function findMatch(student) {
  console.log("🔍 Finding match for:", student.email, "with data:", {
    subjectId: student.subjectId,
    gradeLevelId: student.gradeLevelId,
    preferred_gender_id: student.preferred_gender_id,
    genderId: student.genderId,
  });
  console.log("Current active students:", activeStudents.map(s => ({
    email: s.email,
    student_id: s.student_id,
    subjectId: s.subjectId,
    gradeLevelId: s.gradeLevelId,
    preferred_gender_id: s.preferred_gender_id,
    genderId: s.genderId,
  })));

  return activeStudents.find(other => {
    const match =
      other.student_id !== student.student_id &&
      other.email !== student.email &&
      Number(other.subjectId) === Number(student.subjectId) &&
      Number(other.gradeLevelId) === Number(student.gradeLevelId) &&
      (Number(student.preferred_gender_id) === 0 || Number(other.genderId) === Number(student.preferred_gender_id)) &&
      (Number(other.preferred_gender_id) === 0 || Number(student.genderId) === Number(other.preferred_gender_id));
    console.log(`Comparing ${student.email} (${student.student_id}) with ${other.email} (${other.student_id}):`, match ? "Match found" : "No match");
    return match;
  });
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
            ws.user = user;
            ws.email = email;
            verifiedUsers.set(email, user);
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
            student_id: user.student_id,
            subjectId: Number(subjectId),
            gradeLevelId: Number(gradeLevelId),
            genderId: user.gender,
            preferred_gender_id: Number(preferred_gender_id),
          };

          activeStudents.push(studentData);
          console.log(`Added ${email} to active students queue`);

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
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(JSON.stringify({ message: "❌ Invalid answers format: Missing examId, studentId, answers, or email" }));
            }
            return;
          }
        
          let user = verifiedUsers.get(email) || (await User.findOne({ email })?.toObject());
          if (!user) {
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(JSON.stringify({ message: "❌ Unauthorized: Please verify login first" }));
            }
            console.log(`❌ Unauthorized attempt to submit answers by student ${studentId} (email: ${email})`);
            return;
          }
          if (Number(user.student_id) !== Number(studentId)) {
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(JSON.stringify({ message: "❌ Unauthorized: Student ID does not match verified user" }));
            }
            console.log(`❌ Student ID mismatch: ${studentId} does not match verified user ${user.student_id} (email: ${email})`);
            return;
          }
        
          const userExists = await User.findOne({ randomId: studentId });
          if (!userExists) {
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(JSON.stringify({ message: "❌ User not found in the database" }));
            }
            console.log(`❌ User ${studentId} not found in users table`);
            return;
          }
        
          const exam = await Exam.findById(examId);
          if (!exam || !exam.studentIds.includes(studentId)) {
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(JSON.stringify({ message: "❌ Unauthorized: You did not participate in this exam" }));
            }
            console.log(`❌ User ${studentId} did not participate in exam ${examId}`);
            return;
          }
        
          const examRecord = await ExamRecord.findOne({ examId, studentId });
          if (!examRecord) {
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(JSON.stringify({ message: "❌ Unauthorized: No exam record found for this user" }));
            }
            console.log(`❌ No exam record for user ${studentId} in exam ${examId}`);
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
        
          console.log(`📝 Received answers from user ${studentId} for exam ${examId}`);
          try {
            // ابعت طلب POST لـ /api/exams/submit-answers
            const response = await axios.post('http://localhost:8080/api/exams/submit-answers', {
              examId,
              studentId,
              answers,
              email
            });
            const { score, message } = response.data;
        
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(JSON.stringify({
                type: "exam_results",
                examId,
                score,
                message
              }));
            }
            console.log(`✅ Score calculated for user ${studentId}: ${score}`);
          } catch (error) {
            console.error(`❌ Error submitting answers for user ${studentId}:`, error.message, error.stack);
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(JSON.stringify({
                type: "exam_results",
                examId,
                score: 0,
                message: `❌ Error submitting answers: ${error.message}`
              }));
            }
          }
        }
      } catch (err) {
        console.error("❌ Error handling message:", err.message);
        if (ws.readyState === READY_STATES.OPEN) ws.send(JSON.stringify({ message: "❌ Invalid request format" }));
      }
    });

    ws.on("close", () => {
      if (ws.email) {
        removeStudentFromQueue(ws.email);
        verifiedUsers.delete(ws.email);
        console.log(`${ws.email} disconnected and removed from queue`);
      }
    });
  });
}