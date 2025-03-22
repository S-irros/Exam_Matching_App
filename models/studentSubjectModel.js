import mongoose from "mongoose";

const studentSubjectSchema = new mongoose.Schema({
  studentId: { type: String, required: true, ref: "User" },
  subjectId: { type: Number, required: true, ref: "Subject" },
  gradeLevelId: { type: Number, required: true, ref: "GradeLevel" },
  createdAt: { type: Date, default: Date.now },
});

const StudentSubject = mongoose.model("StudentSubject", studentSubjectSchema);
export default StudentSubject;