// routes/subjectRoutes.js
import express from "express";
import Subject from "../models/subjectModel.js";
import GradeLevel from "../models/gradeLevelModel.js";

const router = express.Router();

// @route   POST /api/subjects
// @desc    إضافة مادة دراسية جديدة
router.post("/", async (req, res) => {
  try {
    const { name, gradeLevelId } = req.body;

    if (!name || !gradeLevelId) {
      return res.status(400).json({ message: "Name and gradeLevelId are required." });
    }

    const existingGradeLevel = await GradeLevel.findOne({ gradeLevelId });
    if (!existingGradeLevel) {
      return res.status(400).json({ message: "Grade level does not exist." });
    }

    const existingSubject = await Subject.findOne({ name, gradeLevelId });
    if (existingSubject) {
      return res.status(400).json({ message: "Subject already exists for this grade level." });
    }

    const subject = new Subject({ name, gradeLevelId });
    await subject.save();

    res.status(201).json({
      message: "Subject added successfully!",
      subject,
    });
  } catch (error) {
    console.error("❌ Error adding subject:", error.message);
    res.status(500).json({ message: "Error adding subject.", error: error.message });
  }
});

// @route   PUT /api/subjects/:id
// @desc    تعديل مادة دراسية
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, gradeLevelId } = req.body;

    if (!name || !gradeLevelId) {
      return res.status(400).json({ message: "Name and gradeLevelId are required." });
    }

    const existingGradeLevel = await GradeLevel.findOne({ gradeLevelId });
    if (!existingGradeLevel) {
      return res.status(400).json({ message: "Grade level does not exist." });
    }

    const subject = await Subject.findOne({ subjectId: id });
    if (!subject) {
      return res.status(404).json({ message: "Subject not found." });
    }

    subject.name = name;
    subject.gradeLevelId = gradeLevelId;
    subject.updatedAt = new Date();
    await subject.save();

    res.status(200).json({
      message: "Subject updated successfully!",
      subject,
    });
  } catch (error) {
    console.error("❌ Error updating subject:", error.message);
    res.status(500).json({ message: "Error updating subject.", error: error.message });
  }
});

// @route   DELETE /api/subjects/:id
// @desc    حذف مادة دراسية
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const subject = await Subject.findOne({ subjectId: id });
    if (!subject) {
      return res.status(404).json({ message: "Subject not found." });
    }

    await Subject.deleteOne({ subjectId: id });
    res.status(200).json({ message: "Subject deleted successfully!" });
  } catch (error) {
    console.error("❌ Error deleting subject:", error.message);
    res.status(500).json({ message: "Error deleting subject.", error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { gradeLevelId } = req.query;

    let subjects;
    if (gradeLevelId) {
      subjects = await Subject.find({ gradeLevelId });
    } else {
      subjects = await Subject.find();
    }

    res.status(200).json(subjects);
  } catch (error) {
    console.error("❌ Error fetching subjects:", error.message);
    res.status(500).json({ message: "Error fetching subjects.", error: error.message });
  }
});

export default router;