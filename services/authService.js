import jwt from "jsonwebtoken";
import User from "../models/User.model.js";

async function verifyToken(email, token) {
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
}

export default verifyToken;