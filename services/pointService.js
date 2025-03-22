import Point from "../models/pointModel.js";

async function updateTotalPoints(studentId, score) {
  try {
    const existing = await Point.findOne({ studentId });
    if (existing) {
      const newTotal = existing.totalPoints + score;
      await Point.updateOne({ studentId }, { $set: { totalPoints: newTotal } });
      console.log(`📊 Total points updated for student ${studentId}: ${newTotal}`);
    } else {
      await Point.create({ studentId, totalPoints: score });
      console.log(`📊 Total points initialized for student ${studentId}: ${score}`);
    }
  } catch (err) {
    console.error("❌ Error updating total points:", err.message);
    throw err;
  }
}

export default updateTotalPoints;