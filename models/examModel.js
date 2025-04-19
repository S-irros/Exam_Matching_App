import mongoose from "mongoose";

const examSchema = new mongoose.Schema({
  questions: [
    {
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
        required: true,
      },
      questionText: { type: String, required: true },
      options: [{ type: String, required: true }],
      marks: { type: Number, default: 5 },
    },
  ],
  studentIds: [{ type: Number }],
  duration: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Exam = mongoose.model("Exam", examSchema);
export default Exam;
