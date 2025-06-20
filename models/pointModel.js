import mongoose, { model, Schema } from "mongoose";
import User from "./User.model.js";
import Rank from "./rankModel.js";

const pointSchema = new Schema(
  {
    studentId: { type: Number, required: true, unique: true },
    totalPoints: { type: Number, default: 0 },
  },
  { timestamps: true }
);

pointSchema.post("save", async function (doc) {
  const PointModel = mongoose.model("Point");
  const user = await User.findOne({ randomId: doc.studentId });
  if (user) {
    user.totalPoints = await PointModel.aggregate([{ $match: { studentId: doc.studentId } }, { $group: { _id: null, total: { $sum: "$totalPoints" } } }]).then(res => res[0]?.total || 0);
    await user.save();
    await Rank.updateOne({ studentId: doc.studentId }, { totalPoints: user.totalPoints, name: user.name, profilePic: user.profilePic || null, profilePicPublicId: user.profilePicPublicId || null }, { upsert: true });
  }
});

const Point = mongoose.models.Point || model("Point", pointSchema);
export default Point;
