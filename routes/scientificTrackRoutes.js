import express from "express";
import ScientificTrack from "../models/ScientificTrack.model.js";
import GradeLevel from "../models/gradeLevelModel.js";

const router = express.Router();

// إضافة شعبة علمية جديدة (بدون مواد في البداية)
router.post("/", async (req, res) => {
  try {
    const { name, gradeLevelId } = req.body;

    if (!name || !gradeLevelId) {
      return res
        .status(400)
        .json({ message: "Name and gradeLevelId are required." });
    }

    const existingTrack = await ScientificTrack.findOne({ name, gradeLevelId });
    if (existingTrack) {
      return res
        .status(400)
        .json({
          message: "Scientific track already exists for this grade level.",
        });
    }

    const gradeLevel = await GradeLevel.findOne({ gradeLevelId });
    if (!gradeLevel) {
      return res.status(404).json({ message: "Grade level not found." });
    }

    // فحص: منع إضافة شعبة للأول الثانوي
    if (gradeLevel.name === "الصف الأول الثانوي") {
      return res
        .status(400)
        .json({ message: "Tracks are not allowed for grade 1." });
    }

    // تحقق خاص بالثالث الثانوي
    if (gradeLevel.name === "الصف الثالث الثانوي" && name === "علمي") {
      return res.status(400).json({
        message:
          "For grade 3 with 'علمي' track, specify a specialization (e.g., 'علمي علوم' or 'علمي رياضة').",
        availableSpecializations: [
          { name: "علمي علوم", suggestion: "Use 'علمي علوم' as name" },
          { name: "علمي رياضة", suggestion: "Use 'علمي رياضة' as name" },
        ],
      });
    }

    const track = new ScientificTrack({
      name,
      gradeLevelId,
      subjects: [],
    });

    await track.save();

    await GradeLevel.updateOne(
      { gradeLevelId },
      { $addToSet: { scientificTrackIds: track.trackId } }
    );

    res.status(201).json({
      message: "Scientific track added successfully!",
      track,
    });
  } catch (error) {
    console.error("❌ Error adding scientific track:", error.message);
    res
      .status(500)
      .json({
        message: "Error adding scientific track.",
        error: error.message,
      });
  }
});

// تحديث شعبة علمية
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, gradeLevelId } = req.body;

    if (!name || !gradeLevelId) {
      return res
        .status(400)
        .json({ message: "Name and gradeLevelId are required." });
    }

    const track = await ScientificTrack.findOne({ trackId: id });
    if (!track) {
      return res.status(404).json({ message: "Scientific track not found." });
    }

    const gradeLevel = await GradeLevel.findOne({ gradeLevelId });
    if (!gradeLevel) {
      return res.status(404).json({ message: "Grade level not found." });
    }

    // فحص: منع إضافة شعبة للأول الثانوي
    if (gradeLevel.name === "الصف الأول الثانوي") {
      return res
        .status(400)
        .json({ message: "Tracks are not allowed for grade 1." });
    }

    // تحقق لو بيعدل الشعبة لـ "علمي" في الثالث الثانوي
    if (gradeLevel.name === "الصف الثالث الثانوي" && name === "علمي") {
      return res.status(400).json({
        message:
          "For grade 3 with 'علمي' track, specify a specialization (e.g., 'علمي علوم' or 'علمي رياضة').",
        availableSpecializations: [
          { name: "علمي علوم", suggestion: "Use 'علمي علوم' as name" },
          { name: "علمي رياضة", suggestion: "Use 'علمي رياضة' as name" },
        ],
      });
    }

    track.name = name;
    track.gradeLevelId = gradeLevelId;
    track.updatedAt = new Date();
    await track.save();

    res.status(200).json({
      message: "Scientific track updated successfully!",
      track,
    });
  } catch (error) {
    console.error("❌ Error updating scientific track:", error.message);
    res
      .status(500)
      .json({
        message: "Error updating scientific track.",
        error: error.message,
      });
  }
});

// حذف شعبة علمية
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const track = await ScientificTrack.findOne({ trackId: id });
    if (!track) {
      return res.status(404).json({ message: "Scientific track not found." });
    }

    await ScientificTrack.deleteOne({ trackId: id });
    res.status(200).json({ message: "Scientific track deleted successfully!" });
  } catch (error) {
    console.error("❌ Error deleting scientific track:", error.message);
    res
      .status(500)
      .json({
        message: "Error deleting scientific track.",
        error: error.message,
      });
  }
});

// جلب جميع الشعب العلمية (اختياري: حسب gradeLevelId)
router.get("/", async (req, res) => {
  try {
    const { gradeLevelId } = req.query;
    const query = gradeLevelId ? { gradeLevelId: Number(gradeLevelId) } : {};
    const tracks = await ScientificTrack.find(query);
    res.status(200).json(tracks);
  } catch (error) {
    console.error("❌ Error fetching scientific tracks:", error.message);
    res
      .status(500)
      .json({
        message: "Error fetching scientific tracks.",
        error: error.message,
      });
  }
});

export default router;
