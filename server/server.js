import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import progressRoutes from "./routes/progress.routes.js";
import quizRoutes from "./routes/quiz.routes.js";
import telemetryRoutes from "./routes/telemetry.routes.js";
import courseProgressRoutes from "./routes/courseProgress.routes.js";
import authRoutes from "./routes/auth.routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/progress", progressRoutes);
app.use("/api/quiz-attempts", quizRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/course-progress", courseProgressRoutes);
app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
