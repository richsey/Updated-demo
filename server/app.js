import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import courseProgressRoutes from "./routes/courseProgress.routes.js";
import progressRoutes from "./routes/progress.routes.js";
import quizRoutes from "./routes/quiz.routes.js";
import interactionRoutes from "./routes/interactionRoutes.js";
import recommendationRoutes from "./routes/recommendationRoutes.js";
import telemetryRoutes from "./routes/telemetryRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

// Authentication
app.use("/api/auth", authRoutes);

// Course & Learning
app.use("/api/course-progress", courseProgressRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/quiz", quizRoutes);

// Interactions & Recommendations
app.use("/api/interactions", interactionRoutes);
app.use("/api/recommendations", recommendationRoutes);

// Analytics
app.use("/api/telemetry", telemetryRoutes);

export default app;
