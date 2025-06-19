import express from "express";
import Point from "../models/pointModel.js";
import User from "../models/User.model.js";

const router = express.Router();

router.post("/clean-points", async (req, res) => {
  try {
    const users = await User.find({}, "randomId").lean();
    const existingUserIds = users.map((u) => u.randomId);

    const result = await Point.deleteMany({ studentId: { $nin: existingUserIds } });

    res.status(200).json({
      message: "Points cleaned successfully!",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("❌ Error cleaning points:", error.message);
    res.status(500).json({ message: "Error cleaning points.", error: error.message });
  }
});

export default router;
