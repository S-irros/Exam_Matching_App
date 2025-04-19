import express from "express";
import User from "../models/User.model.js";
import Point from "../models/pointModel.js";
import Rank from "../models/rankModel.js"; // أضفنا الـ Rank موديل
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// دالة للتحقق من التوكن
const verifyToken = async (email, token) => {
  console.log("Received token:", token);
  try {
    const signature = process.env.SIGNATURE;
    const decoded = jwt.verify(token, signature);
    console.log("Decoded token:", decoded);
    if (!decoded?.id || !decoded.email || decoded.email !== email) {
      throw new Error("Invalid token payload: missing id or email mismatch");
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found in database for email:", email);
      throw new Error("User not found in database");
    }

    return { ...user.toObject(), student_id: user.randomId };
  } catch (err) {
    console.error("❌ Token verification error:", err.message);
    throw new Error(`Token verification failed: ${err.message}`);
  }
};

// Middleware للتحقق من التوكن
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

// روت عرض بروفايل الطالب
router.get("/student-profile", authenticateToken, async (req, res) => {
  const { student_id: rawStudentId } = req.user;
  console.log("Raw studentId from token:", rawStudentId);

  // التأكد من تحويل studentId لـ Number
  const studentId = Number(rawStudentId);
  if (isNaN(studentId)) {
    console.error("❌ Invalid studentId, cannot convert to Number:", rawStudentId);
    return res.status(400).json({ message: "Invalid studentId. It must be a number." });
  }

  console.log("Searching for studentId (as Number):", studentId);

  try {
    // جلب الاسم من جدول User
    const user = await User.findOne({ randomId: studentId }).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // جلب النقاط من جدول Point
    const point = await Point.findOne({ studentId }).lean();
    console.log("Found points for student:", point);

    // جلب الرتبة من جدول Rank
    const rank = await Rank.findOne({ studentId: studentId.toString() }).lean();
    console.log("Found rank for student:", rank);

    let profile = {
      studentId: studentId,
      name: user.name || "Unknown",
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