// app.js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import axios from "axios";
import cron from "node-cron";
import connectToMongoDB from "./config/db.js";
import gradeLevelRoutes from "./routes/gradeLevelRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import questionRoutes from "./routes/questionRoutes.js";
import examRoutes from "./routes/examRoutes.js";
import rankRoutes from "./routes/rankRoutes.js";
import setupWebSocket from "./websocket/websocketHandler.js";
import profileRoutes from "./routes/profileRoutes.js";
import scientificTrackRoutes from "./routes/scientificTrackRoutes.js"
import pointsRoutes from "./routes/PointsRoutes.js"

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

app.use("/api/grade-levels", gradeLevelRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/scientific-track", scientificTrackRoutes);
app.use("/api/exams", examRoutes);
app.use("/api", rankRoutes);
app.use("/api", profileRoutes);
app.use("/api", pointsRoutes);

cron.schedule("*/5 * * * *", async () => {
  console.log("⏰ Scheduled rank update started at:", new Date());
  try {
    await axios.post("http://localhost:8080/api/update-ranks");
    console.log("✅ Rank update completed successfully!");

    await axios.post("http://localhost:8080/api/clean-points");
    console.log("✅ Points cleaned after user deletion");
  } catch (error) {
    console.error("❌ Error in scheduled rank update:", error.message);
  }
});

connectToMongoDB();

setupWebSocket(wss);

server.listen(8080, () => {
  console.log("🚀 Server running at http://localhost:8080");
});