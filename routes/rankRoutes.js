  import express from "express";
  import Rank from "../models/rankModel.js";
  import User from "../models/User.model.js";
  import Point from "../models/pointModel.js";

  const router = express.Router();

  router.post("/update-ranks", async (req, res) => {
    try {
      const pointsData = await Point.find().lean();
      if (pointsData.length === 0) {
        return res.status(200).json({ message: "No students with points found." });
      }

      const rankedStudents = await Promise.all(
        pointsData.map(async (point) => {
          if (point.totalPoints == null || isNaN(point.totalPoints)) {
            console.warn(`⚠️ Invalid totalPoints for studentId: ${point.studentId}, setting to 0`);
            point.totalPoints = 0;
          }
          const user = await User.findOne({ randomId: point.studentId }).lean();
          if (!user) {
            console.warn(`⚠️ User not found for studentId: ${point.studentId}`);
            return {
              studentId: point.studentId,
              name: "Unknown",
              totalPoints: point.totalPoints,
              warning: `User with studentId ${point.studentId} not found in User table.`,
            };
          }
          return {
            studentId: point.studentId,
            name: user.name,
            totalPoints: point.totalPoints,
          };
        })
      );

      rankedStudents.sort((a, b) => b.totalPoints - a.totalPoints);

      const updatedRanks = rankedStudents.map((student, index) => ({
        studentId: student.studentId,
        name: student.name,
        totalPoints: student.totalPoints,
        rank: index + 1,
        updatedAt: new Date(),
        ...(student.warning && { warning: student.warning }),
      }));

      const bulkOps = updatedRanks.map((rank) => ({
        updateOne: {
          filter: { studentId: rank.studentId },
          update: { $set: rank },
          upsert: true, 
        },
      }));

      await Rank.bulkWrite(bulkOps);

      console.log(`📊 Ranks updated for ${updatedRanks.length} students!`);

      res.status(200).json({
        message: "Ranks updated successfully!",
        ranks: updatedRanks,
        warnings: [...new Set(updatedRanks.filter((rank) => rank.warning).map((rank) => rank.warning))], // تحذيرات فريدة
      });
    } catch (error) {
      console.error("❌ Error updating ranks:", error.message);
      res.status(500).json({ message: "Error updating ranks.", error: error.message });
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

      const ranks = await Rank.find(query, null, options);
      if (ranks.length === 0) {
        return res.status(404).json({ message: "No ranks found." });
      }

      res.status(200).json({
        message: "Ranks retrieved successfully!",
        ranks,
      });
    } catch (error) {
      console.error("❌ Error retrieving ranks:", error.message);
      res.status(500).json({ message: "Error retrieving ranks.", error: error.message });
    }
  });

  export default router;