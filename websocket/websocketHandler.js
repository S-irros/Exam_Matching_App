import { startExam, calculateScore } from "../services/examService.js";
import verifyToken from "../services/authService.js";
import User from "../models/User.model.js";
import ExamRecord from "../models/examRecordModel.js";
import Exam from "../models/examModel.js";
import axios from "axios";

const READY_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

const verifiedUsers = new Map();
const activeStudents = [];

function removeStudentFromQueue(email) {
  const index = activeStudents.findIndex((student) => student.email === email);
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

  return activeStudents.find((other) => {
    const isValidStudent =
      student.subjectId &&
      student.gradeLevelId &&
      student.genderId !== undefined &&
      student.preferred_gender_id !== undefined;
    const isValidOther =
      other.subjectId &&
      other.gradeLevelId &&
      other.genderId !== undefined &&
      other.preferred_gender_id !== undefined;
    if (!isValidStudent || !isValidOther) {
      console.log(`❌ Invalid data for ${student.email} or ${other.email}`);
      return false;
    }

    const match =
      other.student_id !== student.student_id &&
      other.email !== student.email &&
      Number(other.subjectId) === Number(student.subjectId) &&
      Number(other.gradeLevelId) === Number(student.gradeLevelId) &&
      (Number(student.preferred_gender_id) === 0 ||
        Number(other.genderId) === Number(student.preferred_gender_id)) &&
      (Number(other.preferred_gender_id) === 0 ||
        Number(student.genderId) === Number(other.preferred_gender_id));
    console.log(
      `Comparing ${student.email} (${student.student_id}) with ${other.email} (${other.student_id}):`,
      match ? "Match found" : "No match"
    );
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
            ws.send(
              JSON.stringify({ message: "✅ Login verified", user: user.name })
            );
            console.log(
              "✅ Verified login for:",
              email,
              "with student_id:",
              user.student_id
            );
          } catch (err) {
            ws.send(
              JSON.stringify({ message: "❌ Login failed", error: err.message })
            );
            console.log("❌ Login failed for:", email);
          }
          return;
        }

        if (data.type === "match_request") {
          const { email, subjectId, preferred_gender_id, gradeLevelId } = data;
          let user = verifiedUsers.get(email) || ws.user;
          if (!user) {
            if (ws.readyState === READY_STATES.OPEN)
              ws.send(JSON.stringify({ message: "❌ Unauthorized request" }));
            return;
          }

          // Check if the student is already in an active exam
          const activeExam = await ExamRecord.findOne({
            studentId: user.student_id,
            completed: false,
          });
          if (activeExam) {
            if (ws.readyState === READY_STATES.OPEN)
              ws.send(
                JSON.stringify({ message: "❌ You are already in an exam" })
              );
            console.log(`❌ ${email} is already in an exam`);
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

            // تحقق إضافي للتأكد إن فيه تطابق حقيقي (مش نفس الشخص)
            if (
              studentData.student_id === match.student_id ||
              studentData.email === match.email
            ) {
              if (ws.readyState === READY_STATES.OPEN)
                ws.send(
                  JSON.stringify({ message: "❌ Cannot match with yourself" })
                );
              console.log(`❌ ${email} tried to match with themselves`);
              return;
            }

            // بدء الامتحان
            const examData = await startExam(studentData, match);

            // إذا مفيش بيانات امتحان، يعني فيه مشكلة
            if (!examData || !examData.examId) {
              if (ws.readyState === READY_STATES.OPEN)
                ws.send(JSON.stringify({ message: "❌ Failed to start exam" }));
              console.log(
                `❌ Failed to start exam for ${email} and ${match.email}`
              );
              return;
            }

            // جلب بيانات الطالب اللي تم التطابق معاه
            const matchedUser = await User.findOne({
              email: match.email,
            }).lean();
            if (!matchedUser) {
              if (ws.readyState === READY_STATES.OPEN)
                ws.send(
                  JSON.stringify({ message: "❌ Matched user not found" })
                );
              console.log(`❌ Matched user ${match.email} not found`);
              return;
            }

            // توليد uniqueChannelName باستخدام examId و student_id
            const uniqueChannelName = `voice_channel_${examData.examId}_${studentData.student_id}_${match.student_id}`;

            // إعداد بيانات الـ response للطالب الأول
            const responseForStudent1 = {
              type: "exam_started",
              examId: examData.examId,
              duration: examData.duration || 20,
              questions: examData.questions || [],
              matchedUser: {
                name: matchedUser.name || "Unknown",
                studentId: matchedUser.student_id,
                gradeLevelId: match.gradeLevelId,
                subjectId: match.subjectId,
              },
              uniqueChannelName: uniqueChannelName, // إضافة الـ uniqueChannelName
            };

            // إعداد بيانات الـ response للطالب الثاني
            const responseForStudent2 = {
              type: "exam_started",
              examId: examData.examId,
              duration: examData.duration || 20,
              questions: examData.questions || [],
              matchedUser: {
                name: user.name || "Unknown",
                studentId: user.student_id,
                gradeLevelId: studentData.gradeLevelId,
                subjectId: studentData.subjectId,
              },
              uniqueChannelName: uniqueChannelName, // نفس الـ uniqueChannelName
            };

            // إزالة الطلاب من قائمة activeStudents
            removeStudentFromQueue(email);
            removeStudentFromQueue(match.email);

            // إرسال الـ response للطالب الأول
            if (studentData.ws.readyState === READY_STATES.OPEN)
              studentData.ws.send(JSON.stringify(responseForStudent1));

            // إرسال الـ response للطالب الثاني
            if (match.ws.readyState === READY_STATES.OPEN)
              match.ws.send(JSON.stringify(responseForStudent2));

            console.log(
              `✅ Exam started for ${email} and ${match.email} with examId: ${examData.examId} and channel: ${uniqueChannelName}`
            );
          } else {
            if (ws.readyState === READY_STATES.OPEN)
              ws.send(JSON.stringify({ message: "🔍 Waiting for match..." }));
          }
        }

        if (data.type === "submit_answers") {
          const { examId, studentId, answers, email } = data;
          if (
            !examId ||
            !studentId ||
            !answers ||
            !Array.isArray(answers) ||
            !email
          ) {
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(
                JSON.stringify({
                  message:
                    "❌ Invalid answers format: Missing examId, studentId, answers, or email",
                })
              );
            }
            return;
          }

          let user =
            verifiedUsers.get(email) ||
            (await User.findOne({ email })?.toObject());
          if (!user) {
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(
                JSON.stringify({
                  message: "❌ Unauthorized: Please verify login first",
                })
              );
            }
            console.log(
              `❌ Unauthorized attempt to submit answers by student ${studentId} (email: ${email})`
            );
            return;
          }
          if (Number(user.student_id) !== Number(studentId)) {
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(
                JSON.stringify({
                  message:
                    "❌ Unauthorized: Student ID does not match verified user",
                })
              );
            }
            console.log(
              `❌ Student ID mismatch: ${studentId} does not match verified user ${user.student_id} (email: ${email})`
            );
            return;
          }

          const userExists = await User.findOne({ randomId: studentId });
          if (!userExists) {
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(
                JSON.stringify({ message: "❌ User not found in the database" })
              );
            }
            console.log(`❌ User ${studentId} not found in users table`);
            return;
          }

          const exam = await Exam.findById(examId);
          if (!exam || !exam.studentIds.includes(studentId)) {
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(
                JSON.stringify({
                  message:
                    "❌ Unauthorized: You did not participate in this exam",
                })
              );
            }
            console.log(
              `❌ User ${studentId} did not participate in exam ${examId}`
            );
            return;
          }

          const examRecord = await ExamRecord.findOne({ examId, studentId });
          if (!examRecord) {
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(
                JSON.stringify({
                  message:
                    "❌ Unauthorized: No exam record found for this user",
                })
              );
            }
            console.log(
              `❌ No exam record for user ${studentId} in exam ${examId}`
            );
            return;
          }

          const existingRecord = await ExamRecord.findOne({
            examId,
            studentId,
            score: { $gt: 0 },
          });
          if (existingRecord) {
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "exam_results",
                  examId,
                  score: existingRecord.score,
                  message:
                    "لقد أجبت على هذا الإمتحان من قبل! درجتك السابقة محفوظة.",
                })
              );
            }
            console.log(
              `⚠️ User ${studentId} already submitted exam ${examId}`
            );
            return;
          }

          console.log(
            `📝 Received answers from user ${studentId} for exam ${examId}`
          );
          try {
            // ابعت طلب POST لـ /api/exams/submit-answers
            const response = await axios.post(
              "http://localhost:8080/api/exams/submit-answers",
              {
                examId,
                studentId,
                answers,
                email,
              }
            );
            const { score, message } = response.data;

            // تحديث حالة ExamRecord لتكون completed
            examRecord.completed = true;
            examRecord.score = score;
            await examRecord.save();
            console.log(
              `✅ Updated ExamRecord for user ${studentId} in exam ${examId} as completed with score: ${score}`
            );

            // إزالة الطالب من activeStudents
            removeStudentFromQueue(email);
            console.log(
              `✅ Removed ${email} from activeStudents after submitting answers`
            );

            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "exam_results",
                  examId,
                  score,
                  message,
                })
              );
            }
            console.log(`✅ Score calculated for user ${studentId}: ${score}`);
          } catch (error) {
            console.error(
              `❌ Error submitting answers for user ${studentId}:`,
              error.message,
              error.stack
            );
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "exam_results",
                  examId,
                  score: 0,
                  message: `❌ Error submitting answers: ${error.message}`,
                })
              );
            }
          }
        }
      } catch (err) {
        console.error(
          "❌ Failed to parse message:",
          err.message,
          "Received:",
          message.toString()
        );
        if (ws.readyState === READY_STATES.OPEN)
          ws.send(JSON.stringify({ message: "❌ Invalid request format" }));
      }
    });

    ws.on("close", () => {
      if (ws.email) {
        removeStudentFromQueue(ws.email);
        verifiedUsers.delete(ws.email);
        console.log(
          `🔴 ${ws.email} disconnected, removed from queue and verifiedUsers`
        );
      }
    });
  });
}