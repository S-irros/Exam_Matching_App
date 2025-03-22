import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: { type: [String], required: true },
  correctAnswer: { type: String, required: true },
  marks: { type: Number, required: true },
  subjectId: { type: Number, required: true },
  gradeLevelId: { type: Number, required: true },
  difficultyLevel: { 
    type: String, 
    enum: ["easy", "medium", "hard"], 
    required: true 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Question = mongoose.model("Question", questionSchema);
export default Question;