import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongoUrl = process.env.DB;

async function connectToMongoDB() {
  try {
    await mongoose.connect(mongoUrl);
    console.log("✅ MongoDB connected successfully to MongoDB Atlas");
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error.message);
    process.exit(1);
  }
}

export default connectToMongoDB;