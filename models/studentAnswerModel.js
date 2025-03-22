import mongoose, { model, Schema } from "mongoose";

const studentAnswerSchema = new Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    studentId: { type: Number, required: true }, // استخدام randomId
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    answer: String,
    points: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const studentAnswerModel =
  mongoose.models.StudentAnswer || model("StudentAnswer", studentAnswerSchema);
export default studentAnswerModel;
