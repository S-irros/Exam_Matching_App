import mongoose, { model, Schema } from "mongoose";

const pointSchema = new Schema(
  {
    studentId: { type: Number, required: true, unique: true },
    totalPoints: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const pointModel = mongoose.models.Point || model("Point", pointSchema);
export default pointModel;
