import mongoose, { model, Schema } from "mongoose";

const pointSchema = new Schema(
  {
    studentId: { type: Number, required: true, unique: true },
    totalPoints: { type: Number, default: 0 },
  },
  { timestamps: true }
);

pointSchema.post("save", async function (doc) {
  const user = await userModel.findOne({ randomId: doc.studentId });
  if (user) {
    user.totalPoints = await Point.aggregate([{ $match: { studentId: doc.studentId } }, { $group: { _id: null, total: { $sum: "$totalPoints" } } }]).then(res => res[0]?.total || 0);
    await user.save();
    await Rank.updateOne({ studentId: doc.studentId }, { totalPoints: user.totalPoints, name: user.name, profilePic: user.profilePic || null, profilePicPublicId: user.profilePicPublicId || null }, { upsert: true });
  }
});

const pointModel = mongoose.models.Point || model("Point", pointSchema);
export default pointModel;
