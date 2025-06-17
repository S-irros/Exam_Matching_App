import jwt from "jsonwebtoken";

async function verifyToken(email, token) {
  console.log("🔍 Verifying token for email:", email, "Token start:", token.slice(0, 20) + "...");
  try {
    const signature = process.env.SIGNATURE;
    if (!signature) {
      throw new Error("SIGNATURE environment variable not set");
    }

    const decoded = jwt.verify(token, signature, { ignoreExpiration: false });
    console.log("✅ Decoded token:", decoded);

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
      scientificTrack: decoded.scientificTrack,
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
    console.error("❌ Token verification error:", err.message, "Error type:", err.name, "Stack:", err.stack);
    throw new Error(`Token verification failed: ${err.message}`);
  }
}

export default verifyToken;