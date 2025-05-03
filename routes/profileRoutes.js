import express from "express";
import Point from "../models/pointModel.js";
import Rank from "../models/rankModel.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import verifyToken from "../services/authService.js";

dotenv.config();

const router = express.Router();

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.SIGNATURE);
    if (!decoded?.email) {
      return res.status(401).json({ message: "Invalid token payload: missing email." });
    }

    const authUser = await verifyToken(decoded.email, token);
    req.user = authUser;
    req.studentId = authUser.student_id;
    next();
  } catch (error) {
    console.error("❌ Invalid token:", error.message);
    return res.status(403).json({ message: "Invalid or expired token.", error: error.message });
  }
};

router.get("/student-profile", authenticateToken, async (req, res) => {
  const { student_id: rawStudentId, name, profilePic, profilePicPublicId } = req.user;
  console.log("Raw studentId from token:", rawStudentId);

  const studentId = Number(rawStudentId);
  if (isNaN(studentId)) {
    console.error("❌ Invalid studentId, cannot convert to Number:", rawStudentId);
    return res.status(400).json({ message: "Invalid studentId. It must be a number." });
  }

  console.log("Searching for studentId (as Number):", studentId);

  try {
    const point = await Point.findOne({ studentId }).lean();
    console.log("Found points for student:", point);

    const rank = await Rank.findOne({ studentId: studentId.toString() }).lean();
    console.log("Found rank for student:", rank);

    let profile = {
      studentId: studentId,
      name: name || "Unknown",
      profilePic: profilePic || null,
      profilePicPublicId: profilePicPublicId || null,
      totalPoints: point ? point.totalPoints : 0,
      rank: rank ? rank.rank : null,
    };

    res.status(200).json({
      message: "Student profile retrieved successfully!",
      profile,
    });
  } catch (error) {
    console.error("❌ Error retrieving student profile:", error.message);
    res.status(500).json({ message: "Error retrieving student profile.", error: error.message });
  }
});

export default router;