import express from "express";
import Subject from "../models/subjectModel.js";
import GradeLevel from "../models/gradeLevelModel.js";
import ScientificTrack from "../models/ScientificTrack.model.js";

const router = express.Router();

// @route   POST /api/subjects
// @desc    إضافة مادة دراسية جديدة
router.post("/", async (req, res) => {
  try {
    const { name, gradeLevelId, scientificTrackId } = req.body;
    if (!name || !gradeLevelId) {
      return res
        .status(400)
        .json({ message: "Name and gradeLevelId are required." });
    }

    const existingGradeLevel = await GradeLevel.findOne({ gradeLevelId });
    if (!existingGradeLevel) {
      return res.status(400).json({ message: "Grade level does not exist." });
    }

    if ([5896, 8842].includes(Number(gradeLevelId)) && !scientificTrackId) {
      return res
        .status(400)
        .json({ message: "Scientific track ID is required for grade 2 or 3." });
    }

    if (gradeLevelId === 8321 && scientificTrackId) {
      return res
        .status(400)
        .json({ message: "Scientific track ID is not allowed for grade 1." });
    }

    if (scientificTrackId) {
      const existingTrack = await ScientificTrack.findOne({
        trackId: Number(scientificTrackId),
      });
      if (!existingTrack || existingTrack.gradeLevelId !== Number(gradeLevelId)) {
        return res
          .status(400)
          .json({
            message: "Invalid scientific track ID for this grade level.",
          });
      }
    }

    const existingSubject = await Subject.findOne({
      name,
      gradeLevelId: Number(gradeLevelId),
      scientificTrackId: Number(scientificTrackId),
    });
    if (existingSubject) {
      return res
        .status(400)
        .json({
          message: "Subject already exists for this grade level and track.",
        });
    }

    const subject = new Subject({
      name,
      gradeLevelId: Number(gradeLevelId),
      scientificTrackId: scientificTrackId ? Number(scientificTrackId) : null,
    });
    await subject.save();

    // تحديث subjects في ScientificTrack
    if (scientificTrackId) {
      await ScientificTrack.updateOne(
        { trackId: Number(scientificTrackId) },
        { $addToSet: { subjects: subject.subjectId } }
      );
    }

    // أضف المادة للـ subjects array في GradeLevel
    if (
      gradeLevelId === 8321 ||
      (scientificTrackId && [5896, 8842].includes(Number(gradeLevelId)))
    ) {
      await GradeLevel.updateOne(
        { gradeLevelId: Number(gradeLevelId) },
        { $addToSet: { subjects: subject.subjectId } }
      ).then((result) => {
        if (result.modifiedCount === 0) {
          console.log("No update performed on GradeLevel");
        }
      });
    }

    res.status(201).json({
      message: "Subject added successfully!",
      subject,
    });
  } catch (error) {
    console.error("❌ Error adding subject:", error.message);
    res
      .status(500)
      .json({ message: "Error adding subject.", error: error.message });
  }
});

// @route   DELETE /api/subjects/:id
// @desc    حذف مادة دراسية
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const subject = await Subject.findOne({ subjectId: Number(id) });
    if (!subject) {
      return res.status(404).json({ message: "Subject not found." });
    }

    await Subject.deleteOne({ subjectId: Number(id) });
    res.status(200).json({ message: "Subject deleted successfully!" });
  } catch (error) {
    console.error("❌ Error deleting subject:", error.message);
    res
      .status(500)
      .json({ message: "Error deleting subject.", error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { gradeLevelId, scientificTrackId } = req.query;
    const query = {};
    if (gradeLevelId) query.gradeLevelId = Number(gradeLevelId);
    if (scientificTrackId) query.scientificTrackId = Number(scientificTrackId);

    const mySubjects = await Subject.find(query).populate("gradeLevelRef");

    res.status(200).json(mySubjects);
  } catch (error) {
    console.error("❌ Error fetching subjects:", error.message);
    res
      .status(500)
      .json({ message: "Error fetching subjects.", error: error.message });
  }
});

export default router;