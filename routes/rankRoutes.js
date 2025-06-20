import express from "express";
import Rank from "../models/rankModel.js";
import User from "../models/User.model.js";
import Point from "../models/pointModel.js";
import axios from "axios";

const router = express.Router();

export const deleteUserAndUpdateRanks = async (filter) => {
  const user = await User.findOne(filter);
  if (!user) return null;

  await User.deleteOne({ _id: user._id });
  await Rank.deleteOne({ studentId: user.randomId });
  await Point.deleteOne({ studentId: user.randomId });

  try {
    await axios.post("http://localhost:5000/api/update-ranks");
    console.log("✅ Ranks updated after user deletion");

    await axios.post("http://localhost:5000/api/clean-points");
    console.log("✅ Points cleaned after user deletion");
  } catch (err) {
    console.error("❌ Failed to update ranks:", err.message);
  }

  return user;
};

router.post("/update-ranks", async (req, res) => {
  try {
    const usersWithPoints = await User.find({ isDeleted: false }).lean();

    if (!usersWithPoints.length)
      return res.status(200).json({ message: "No students found." });

    const rankedStudents = usersWithPoints
      .filter((user) => user.totalPoints > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints);

    const updatedRanks = rankedStudents.map((student, index) => ({
      studentId: student.randomId,
      totalPoints: student.totalPoints,
      rank: index + 1,
      name: student.name,
      profilePic:
        student.profilePic || "https://default-profile-pic-url.com/default.jpg",
      profilePicPublicId: student.profilePicPublicId || null,
      updatedAt: new Date(),
    }));

    // تحديث جدول Ranks
    await Rank.bulkWrite(
      updatedRanks.map((rank) => ({
        updateOne: {
          filter: { studentId: rank.studentId },
          update: { $set: rank },
          upsert: true,
        },
      }))
    );

    // ✅ حذف الـ ranks الخاصة بمستخدمين اتحذفوا من جدول users
    const currentUserIds = usersWithPoints.map((u) => u.randomId);
    await Rank.deleteMany({ studentId: { $nin: currentUserIds } });

    // ✅ تحديث الـ rank داخل جدول Users
    await Promise.all(
      usersWithPoints.map((user) => {
        const found = updatedRanks.find(
          (rank) => rank.studentId === user.randomId
        );
        return User.updateOne(
          { randomId: user.randomId },
          { rank: found ? found.rank : 0 }
        );
      })
    );

    res.status(200).json({
      message: "Ranks updated successfully!",
      ranks: updatedRanks,
    });
  } catch (error) {
    console.error("❌ Error updating ranks:", error.message);
    res
      .status(500)
      .json({ message: "Error updating ranks.", error: error.message });
  }
});

router.get("/ranks", async (req, res) => {
  try {
    const { limit } = req.query;
    const query = {};
    const options = { sort: { rank: 1 }, lean: true };

    if (limit && !isNaN(limit)) {
      options.limit = Number(limit);
    }

    const ranks = await Rank.find(query, null, options).sort({ totalPoints: -1 });
    if (ranks.length === 0) {
      return res.status(404).json({ message: "No ranks found." });
    }

    res.status(200).json({
      message: "Ranks retrieved successfully!",
      ranks,
    });
  } catch (error) {
    console.error("❌ Error retrieving ranks:", error.message);
    res
      .status(500)
      .json({ message: "Error retrieving ranks.", error: error.message });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const deletedUser = await deleteUserAndUpdateRanks({ _id: req.params.id });
    if (!deletedUser) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "User deleted and ranks updated" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting user", error: err.message });
  }
});

export default router;
