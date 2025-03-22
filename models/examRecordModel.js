import mongoose, { model, Schema } from "mongoose";

const examRecordSchema = new Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    studentId: { type: Number, required: true },
    score: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const examRecordModel =
  mongoose.models.ExamRecord || model("ExamRecord", examRecordSchema);
export default examRecordModel;
