import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema({
  subjectId: { 
    type: Number, 
    required: true, 
    unique: true, 
    default: () => Math.floor(1000 + Math.random() * 9000)
  },
  name: { type: String, required: true },
  gradeLevelId: { type: Number, required: true, ref: "GradeLevel" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Subject = mongoose.model("Subject", subjectSchema);
export default Subject;