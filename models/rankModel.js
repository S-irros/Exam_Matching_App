import mongoose from "mongoose";

const rankSchema = new mongoose.Schema({
  studentId: { type: Number, required: true, ref: "User" },
  name: { type: String, required: true },
  totalPoints: { type: Number, required: true, default: 0 },
  rank: { type: Number, required: true },
  profilePic: { type: String, default: null },
  profilePicPublicId: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now },
});

const Rank = mongoose.model("Rank", rankSchema);
export default Rank;