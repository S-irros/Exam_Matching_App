import express from "express";
import Subject from "../models/subjectModel.js";
import GradeLevel from "../models/gradeLevelModel.js";
import ScientificTrack from "../models/ScientificTrack.model.js";
import verifyToken from "../services/authService.js";

const router = express.Router();

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }
  try {
    const email = req.query.email || "default@example.com"; // افتراضي، يفضل تحديد email من request
    const user = await verifyToken(email, token);
    req.user = user;
    console.log(
      "🔍 [AUTH] User verified:",
      user.name,
      "Subjects:",
      user.subjects
    );
    next();
  } catch (error) {
    console.error("❌ [AUTH] Token verification failed:", error.message);
    res.status(401).json({ message: "Invalid token.", error: error.message });
  }
};

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
      if (
        !existingTrack ||
        existingTrack.gradeLevelId !== Number(gradeLevelId)
      ) {
        return res.status(400).json({
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
      return res.status(400).json({
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

router.get("/", authMiddleware, async (req, res) => {
  console.log("🔍 [GET_SUBJECTS] Request received with query:", req.query);
  try {
    const { gradeLevelId, scientificTrackId } = req.query;
    let query = {};

    if (scientificTrackId) {
      query.scientificTrackId = Number(scientificTrackId);
      if (gradeLevelId) {
        const track = await ScientificTrack.findOne({
          trackId: Number(scientificTrackId),
        });
        if (track && track.gradeLevelId !== Number(gradeLevelId)) {
          console.log("❌ [GET_SUBJECTS] Track mismatch");
          return res
            .status(400)
            .json({ message: "Scientific track does not match grade level." });
        }
        query.gradeLevelId = Number(gradeLevelId);
      }
    } else if (gradeLevelId) {
      query.gradeLevelId = Number(gradeLevelId);
    } else {
      console.log("❌ [GET_SUBJECTS] Missing params");
      return res
        .status(400)
        .json({ message: "gradeLevelId or scientificTrackId is required." });
    }

    // فلترة بناءً على subjects من الـ token
    const userSubjects = req.user.subjects || [];
    if (userSubjects.length > 0) {
      query.subjectId = { $in: userSubjects.map((id) => Number(id)) };
    }
    console.log("🔍 [GET_SUBJECTS] Query constructed:", query);

    const mySubjects = await Subject.find(query).populate("gradeLevelRef");
    console.log("✅ [GET_SUBJECTS] Subjects fetched:", mySubjects.length);
    if (!mySubjects || mySubjects.length === 0) {
      console.log("⚠️ [GET_SUBJECTS] No subjects found");
      return res
        .status(404)
        .json({ message: "No subjects found for the given track or grade." });
    }

    res.status(200).json(mySubjects);
  } catch (error) {
    console.error(
      "❌ [GET_SUBJECTS] Error:",
      error.message,
      "Stack:",
      error.stack
    );
    res
      .status(500)
      .json({ message: "Error fetching subjects.", error: error.message });
  }
});

export default router;