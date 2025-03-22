import mongoose, { model, Schema } from "mongoose";

const examSchema = new Schema(
  {
    questions: [
      {
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
        questionText: String,
        options: [String],
        marks: Number,
      },
    ],
    duration: Number,
  },
  { timestamps: true }
);

const examModel = mongoose.models.Exam || model("Exam", examSchema);
export default examModel;
