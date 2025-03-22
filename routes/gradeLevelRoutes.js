import express from "express";
import GradeLevel from "../models/gradeLevelModel.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required." });
    }

    const existingGradeLevel = await GradeLevel.findOne({ name });
    if (existingGradeLevel) {
      return res.status(400).json({ message: "Grade level already exists." });
    }

    const gradeLevel = new GradeLevel({ name });
    await gradeLevel.save();

    res.status(201).json({
      message: "Grade level added successfully!",
      gradeLevel,
    });
  } catch (error) {
    console.error("❌ Error adding grade level:", error.message);
    res.status(500).json({ message: "Error adding grade level.", error: error.message });
  }
});


router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required." });
    }

    const gradeLevel = await GradeLevel.findOne({ gradeLevelId: id });
    if (!gradeLevel) {
      return res.status(404).json({ message: "Grade level not found." });
    }

    gradeLevel.name = name;
    gradeLevel.updatedAt = new Date();
    await gradeLevel.save();

    res.status(200).json({
      message: "Grade level updated successfully!",
      gradeLevel,
    });
  } catch (error) {
    console.error("❌ Error updating grade level:", error.message);
    res.status(500).json({ message: "Error updating grade level.", error: error.message });
  }
});


router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const gradeLevel = await GradeLevel.findOne({ gradeLevelId: id });
    if (!gradeLevel) {
      return res.status(404).json({ message: "Grade level not found." });
    }

    await GradeLevel.deleteOne({ gradeLevelId: id });
    res.status(200).json({ message: "Grade level deleted successfully!" });
  } catch (error) {
    console.error("❌ Error deleting grade level:", error.message);
    res.status(500).json({ message: "Error deleting grade level.", error: error.message });
  }
});


router.get("/", async (req, res) => {
  try {
    const gradeLevels = await GradeLevel.find();
    res.status(200).json(gradeLevels);
  } catch (error) {
    console.error("❌ Error fetching grade levels:", error.message);
    res.status(500).json({ message: "Error fetching grade levels.", error: error.message });
  }
});

export default router;