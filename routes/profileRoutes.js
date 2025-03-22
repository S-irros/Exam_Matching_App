import express from "express";
import User from "../models/User.model.js";
import Point from "../models/pointModel.js";
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
    if (user.role !== "student") {
      console.log("User role is not student:", user.role);
      throw new Error("User is not a student");
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
  const { student_id: studentId } = req.user; // تصحيح اسم المفتاح
  console.log("Searching for studentId (as String):", studentId);
  console.log("Searching for studentId (as Number):", Number(studentId));

  // التحقق من وجود studentId
  if (!studentId) {
    return res.status(400).json({ message: "Student ID is missing from user data." });
  }

  try {
    // جلب الاسم من جدول User
    const user = await User.findOne({ randomId: studentId }).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // جلب جميع الطلاب وترتيبهم بناءً على النقاط
    const allStudents = await Point.find().sort({ totalPoints: -1 }).lean();
    console.log("All students from Point:", allStudents);

    let profile = {
      studentId: studentId,
      name: user.name || "Unknown",
      totalPoints: 0,
      rank: null,
    };

    if (allStudents.length > 0) {
      const studentIndex = allStudents.findIndex(student => Number(student.studentId) === Number(studentId));
      console.log("Student index:", studentIndex);
      if (studentIndex !== -1) {
        const studentRank = studentIndex + 1;
        const studentData = allStudents[studentIndex];
        profile.totalPoints = studentData.totalPoints;
        profile.rank = studentRank;
      }
    }

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