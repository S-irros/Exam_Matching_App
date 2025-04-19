import jwt from "jsonwebtoken";

async function verifyToken(email, token) {
  console.log("Received token:", token);
  try {
    const signature = process.env.SIGNATURE;
    const decoded = jwt.verify(token, signature);
    console.log("Decoded token:", decoded);

    if (!decoded?.id || !decoded.email || decoded.email !== email) {
      throw new Error("Invalid token payload: missing id or email mismatch");
    }

    return {
      id: decoded.id,
      student_id: decoded.randomId,
      email: decoded.email,
      name: decoded.name,
      gradeLevelId: decoded.gradeLevelId,
      subjects: decoded.subjects,
      status: decoded.status,
      availability: decoded.availability,
      gender: decoded.gender,
      role: decoded.role,
      isConfirmed: decoded.isConfirmed,
      isDeleted: decoded.isDeleted,
      isBlocked: decoded.isBlocked,
      profilePic: decoded.profilePic,
      profilePicPublicId: decoded.profilePicPublicId,
    };
  } catch (err) {
    console.error("❌ Token verification error:", err.message);
    throw new Error(`Token verification failed: ${err.message}`);
  }
}

export default verifyToken;