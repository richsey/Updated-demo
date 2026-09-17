import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import progressRoutes from "./routes/progress.routes.js";
import quizRoutes from "./routes/quiz.routes.js";
import telemetryRoutes from "./routes/telemetry.routes.js";
import courseProgressRoutes from "./routes/courseProgress.routes.js";
import authRoutes from "./routes/auth.routes.js";
import metadataRoutes from "./routes/metadata.routes.js";

dotenv.config();

const app = express();

// ─── Security Headers ──────────────────────────────────────────────────────
// Apply helmet if available; adds X-Content-Type-Options, X-Frame-Options,
// X-XSS-Protection, Referrer-Policy, HSTS, etc.
try {
  const { default: helmet } = await import("helmet");
  app.use(helmet());
} catch {
  // helmet not installed — add minimal headers manually
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
}

// ─── Rate Limiting ────────────────────────────────────────────────────────
let rateLimit;
try {
  const rl = await import("express-rate-limit");
  rateLimit = rl.default || rl.rateLimit;
} catch {
  // express-rate-limit not installed — no-op
  rateLimit = null;
}

if (rateLimit) {
  // General API: 100 requests / 15 minutes per IP
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again later." },
  });
  app.use("/api", generalLimiter);

  // Auth routes: stricter — 10 requests / 15 minutes per IP
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many auth requests. Please wait before trying again." },
  });
  app.use("/api/auth", authLimiter);
}

// ─── CORS ─────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "https://updated-demo.vercel.app",
  "https://updated-studysync.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://server-production-4f60.up.railway.app",
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));

app.use("/api/progress", progressRoutes);
app.use("/api/quiz-attempts", quizRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/course-progress", courseProgressRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/metadata", metadataRoutes);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
