import mongoose, { model, Schema } from "mongoose";

const studentAnswerSchema = new Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    studentId: { type: Number, required: true },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    answer: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
    score: { type: Number, required: true },
    marks: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const studentAnswerModel =
  mongoose.models.StudentAnswer || model("StudentAnswer", studentAnswerSchema);
export default studentAnswerModel;