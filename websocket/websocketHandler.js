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
    console.log(
      `Removed ${email} from active students queue. Current activeStudents:`,
      activeStudents.map((s) => s.email)
    );
  }
}

function findMatch(student) {
  console.log("🔍 Finding match for:", student.email, "with data:", {
    subjectId: student.subjectId,
    gradeLevelId: student.gradeLevelId,
    preferred_gender_id: student.preferred_gender_id,
    genderId: student.genderId,
    scientificTrackId: student.scientificTrackId,
    totalPoints: student.totalPoints,
  });

  return activeStudents.find((other) => {
    const isValidStudent =
      typeof student.subjectId === "number" &&
      typeof student.gradeLevelId === "number" &&
      typeof student.genderId === "number" &&
      typeof student.preferred_gender_id === "number" &&
      (student.scientificTrackId === undefined ||
        typeof student.scientificTrackId === "number") &&
      typeof student.totalPoints === "number";
    const isValidOther =
      typeof other.subjectId === "number" &&
      typeof other.gradeLevelId === "number" &&
      typeof other.genderId === "number" &&
      typeof other.preferred_gender_id === "number" &&
      (other.scientificTrackId === undefined ||
        typeof other.scientificTrackId === "number") &&
      typeof other.totalPoints === "number";

    if (!isValidStudent || !isValidOther) {
      console.log(`❌ Invalid data for ${student.email} أو ${other.email}`, {
        studentData: student,
        otherData: other,
      });
      return false;
    }

    const pointsMatch =
      (student.totalPoints >= 0 &&
        student.totalPoints <= 400 &&
        other.totalPoints >= 0 &&
        other.totalPoints <= 400) ||
      (student.totalPoints >= 401 &&
        student.totalPoints <= 800 &&
        other.totalPoints >= 401 &&
        other.totalPoints <= 800) ||
      (student.totalPoints >= 801 &&
        student.totalPoints <= 1200 &&
        other.totalPoints >= 801 &&
        other.totalPoints <= 1200) ||
      (student.totalPoints >= 1201 && other.totalPoints >= 1201);

    const match =
      other.student_id !== student.student_id &&
      other.email !== student.email &&
      other.subjectId === student.subjectId &&
      other.gradeLevelId === student.gradeLevelId &&
      (student.scientificTrackId === undefined ||
        other.scientificTrackId === undefined ||
        other.scientificTrackId === student.scientificTrackId) &&
      pointsMatch &&
      (student.preferred_gender_id === 0 ||
        other.genderId === student.preferred_gender_id) &&
      (other.preferred_gender_id === 0 ||
        student.genderId === other.preferred_gender_id);
    console.log(
      `Comparing ${student.email} (${student.student_id}) with ${other.email} (${other.student_id}):`,
      match ? "Match found" : "No match"
    );
    return match;
  });
}

export default function setupWebSocket(wss) {
  // دالة لمراقبة الاتصال
  function monitorConnection(ws, email) {
    let pingTimeout = null;

    const pingInterval = setInterval(() => {
      if (ws.readyState === READY_STATES.OPEN) {
        // تحقق إذا كان الطالب في activeStudents
        if (activeStudents.some((s) => s.email === email)) {
          ws.ping();
          console.log(`📡 Sent Ping to ${email}`);
          pingTimeout = setTimeout(() => {
            console.log(`⏰ No Pong from ${email}, assuming disconnection`);
            removeStudentFromQueue(email);
            clearInterval(pingInterval);
            clearTimeout(pingTimeout);
          }, 15000); // 3 ثواني
        } else {
          console.log(`⚠️ ${email} not in activeStudents, stopping ping`);
          clearInterval(pingInterval);
          clearTimeout(pingTimeout);
        }
      } else {
        clearInterval(pingInterval);
        clearTimeout(pingTimeout);
      }
    }, 10000); // 5 ثواني

    ws.on("pong", () => {
      console.log(`🏓 Received Pong from ${email}`);
      clearTimeout(pingTimeout);
    });

    ws.on("close", () => {
      clearInterval(pingInterval);
      clearTimeout(pingTimeout);
    });
  }

  wss.on("connection", (ws) => {
    console.log(`🟢 New WebSocket connection for ${ws.email || "unknown"}`);

    ws.on("message", async (message) => {
      console.log("📩 Received raw message:", message.toString());
      try {
        const data = JSON.parse(message);
        console.log("✅ Parsed message:", data);

        if (data.type === "verify_login") {
          const { email, token } = data;
          console.log("🔍 Attempting to verify login for:", email);
          try {
            const user = await verifyToken(email, token);
            verifiedUsers.delete(email);
            ws.user = user;
            ws.email = email;
            verifiedUsers.set(email, user);
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(
                JSON.stringify({
                  message: "✅ Login verified",
                  user: user.name,
                })
              );
              console.log(
                "✅ Verified login for:",
                email,
                "student_id:",
                user.student_id
              );
            } else {
              console.log("⚠️ WebSocket not open, state:", ws.readyState);
            }
          } catch (err) {
            console.error("❌ Login error for:", email, "Error:", err.message);
            if (ws.readyState === READY_STATES.OPEN) {
              ws.send(
                JSON.stringify({
                  message: "❌ Login failed",
                  error: err.message,
                })
              );
            }
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

          if (activeStudents.some((s) => s.email === email)) {
            removeStudentFromQueue(email); // إزالة الطالب من الـ queue قبل إعادة المحاولة
            console.log(
              `⚠️ ${email} was in queue, removed to retry matchmaking`
            );
          }

          const userFromDB = await User.findOne({ email }).select(
            "scientificTrack totalPoints gender"
          );
          const scientificTrackId = userFromDB?.scientificTrack || undefined;
          const totalPoints = userFromDB?.totalPoints || 0;
          const genderId = userFromDB?.gender || user.genderId;

          const studentData = {
            ws,
            email: user.email,
            student_id: user.student_id,
            subjectId: Number(subjectId),
            gradeLevelId: Number(gradeLevelId),
            genderId,
            preferred_gender_id: Number(preferred_gender_id),
            scientificTrackId,
            totalPoints,
            isExamStarted: false, // تهيئة المتغير
          };

          activeStudents.push(studentData);
          console.log(
            `Added ${email} to active students queue. Current activeStudents:`,
            activeStudents.map((s) => s.email)
          );

          let matchInterval;

          const tryMatching = async () => {
            const match = findMatch(studentData);
            if (match) {
              console.log(`✅ Match found between ${email} و ${match.email}`);
              if (
                studentData.student_id === match.student_id ||
                studentData.email === match.email
              ) {
                if (ws.readyState === READY_STATES.OPEN)
                  ws.send(
                    JSON.stringify({ message: "❌ Cannot match with yourself" })
                  );
                console.log(`❌ ${email} tried to match with themselves`);
                removeStudentFromQueue(email);
                clearInterval(matchInterval);
                return;
              }

              if (!studentData.isExamStarted && !match.isExamStarted) {
                studentData.isExamStarted = true;
                match.isExamStarted = true;

                console.log(
                  `Attempting to start exam for ${email} and ${match.email}`
                );
                const examData = await startExam(studentData, match);
                console.log(
                  `Exam data from startExam: ${JSON.stringify(examData)}`
                );
                if (!examData || !examData.examId) {
                  console.log(
                    `❌ Failed to start exam, examData: ${JSON.stringify(
                      examData
                    )}`
                  );
                  if (ws.readyState === READY_STATES.OPEN)
                    ws.send(
                      JSON.stringify({
                        message: "❌ Failed to start exam",
                        error: "Invalid exam data",
                      })
                    );
                  if (match.ws.readyState === READY_STATES.OPEN)
                    match.ws.send(
                      JSON.stringify({
                        message: "❌ Failed to start exam",
                        error: "Invalid exam data",
                      })
                    );
                  removeStudentFromQueue(email);
                  removeStudentFromQueue(match.email);
                  clearInterval(matchInterval);
                  return;
                }

                console.log(
                  `match.email: ${match.email}, match.student_id: ${match.student_id}`
                );
                const matchedUser = await User.findOne({
                  email: match.email,
                }).lean();
                if (!matchedUser) {
                  if (ws.readyState === READY_STATES.OPEN)
                    ws.send(
                      JSON.stringify({ message: "❌ Matched user not found" })
                    );
                  console.log(`❌ Matched user ${match.email} not found`);
                  removeStudentFromQueue(email);
                  clearInterval(matchInterval);
                  return;
                }

                const uniqueChannelName = `voice_channel_${examData.examId}_${studentData.student_id}_${match.student_id}`;
                const matchedUserFromDB = await User.findOne({
                  email: match.email,
                }).lean();
                const studentUserFromDB = await User.findOne({
                  email: studentData.email,
                }).lean();

                const sendExamStart = (
                  student,
                  other,
                  userFromDB,
                  otherUserFromDB
                ) => {
                  const response = {
                    type: "exam_started",
                    examId: examData.examId,
                    duration: examData.duration || 20,
                    questions: examData.questions || [],
                    matchedUser: {
                      name: otherUserFromDB?.name || "Unknown",
                      studentId: otherUserFromDB?.randomId?.toString() || "N/A",
                      profilePic: otherUserFromDB?.profilePic || "",
                      rank: otherUserFromDB?.rank,
                      gradeLevelId: other.gradeLevelId,
                      subjectId: other.subjectId,
                    },
                    uniqueChannelName,
                  };
                  if (student.ws.readyState === READY_STATES.OPEN) {
                    student.ws.send(JSON.stringify(response));
                    console.log(`Sent exam_started to ${student.email}`);
                  }
                };

                sendExamStart(
                  studentData,
                  match,
                  studentUserFromDB,
                  matchedUserFromDB
                );
                sendExamStart(
                  match,
                  studentData,
                  matchedUserFromDB,
                  studentUserFromDB
                );

                removeStudentFromQueue(email);
                removeStudentFromQueue(match.email);
                clearInterval(matchInterval);

                console.log(
                  `✅ Exam started for ${email} and ${match.email} with examId: ${examData.examId} and channel: ${uniqueChannelName}`
                );
              }
            } else {
              if (ws.readyState === READY_STATES.OPEN) {
                ws.send(JSON.stringify({ message: "🔍 Waiting for match..." }));
              }
            }
          };

          // أول محاولة فورية
          await tryMatching();

          // بدء الماتشينج كل 5 ثواني
          matchInterval = setInterval(async () => {
            if (!activeStudents.some((s) => s.email === email)) {
              clearInterval(matchInterval);
              return;
            }
            await tryMatching();
          }, 5000);

          // Timeout بعد 30 ثانية لو مفيش match
          setTimeout(() => {
            if (activeStudents.some((s) => s.email === email)) {
              clearInterval(matchInterval);
              removeStudentFromQueue(email);
              if (ws.readyState === READY_STATES.OPEN) {
                ws.send(
                  JSON.stringify({
                    message: "⏰ Matchmaking timeout. Please try again.",
                  })
                );
              }
              console.log(`⏰ Removed ${email} from queue due to timeout`);
            }
          }, 90000);

          // بدء مراقبة الاتصال
          monitorConnection(ws, email);
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

            examRecord.completed = true;
            examRecord.score = score;
            await examRecord.save();

            const userToUpdate = await User.findOne({ randomId: studentId });
            if (userToUpdate) {
              userToUpdate.totalPoints =
                (userToUpdate.totalPoints || 0) + score;
              await userToUpdate.save({ validateBeforeSave: false });
              console.log(
                `✅ Updated totalPoints for user ${studentId} to ${userToUpdate.totalPoints}`
              );
            } else {
              console.log(
                `⚠️ User ${studentId} not found for updating totalPoints`
              );
            }

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
                  questions: response.data.questions,
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

    ws.on("close", (code, reason) => {
      if (ws.email) {
        removeStudentFromQueue(ws.email);
        verifiedUsers.delete(ws.email);
        console.log(
          `🔴 ${ws.email} disconnected, code: ${code}, reason: ${
            reason || "No reason provided"
          }, removed from queue and verifiedUsers. activeStudents:`,
          activeStudents.map((s) => s.email)
        );
      }
    });
  });
}
