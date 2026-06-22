import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { ZodError } from "zod";
import { env, corsOrigins } from "./config.js";
import healthRouter from "./routes/health.js";
import filtersRouter from "./routes/filters.js";
import kpisRouter from "./routes/kpis.js";
import activityRouter from "./routes/activity.js";
import schoolsRouter from "./routes/schools.js";
import coursesRouter from "./routes/courses.js";
import subjectsRouter from "./routes/subjects.js";
import videosRouter from "./routes/videos.js";
import mcqRouter from "./routes/mcq.js";
import studentsRouter from "./routes/students.js";
import reportRouter from "./routes/report.js";
import authRouter from "./routes/auth.js";
import cronRouter from "./routes/cron.js";
import { scheduleDailyIngest } from "./jobs/dailyIngest.js";

const app = express();

app.use(
  cors({
    origin: corsOrigins.includes("*") ? true : corsOrigins,
    credentials: true,
  }),
);
app.use(express.json());

app.use("/api", healthRouter);
app.use("/api/filters", filtersRouter);
app.use("/api/kpis", kpisRouter);
app.use("/api/activity", activityRouter);
app.use("/api/schools", schoolsRouter);
app.use("/api/courses", coursesRouter);
app.use("/api/subjects", subjectsRouter);
app.use("/api/videos", videosRouter);
app.use("/api/mcq", mcqRouter);
app.use("/api/students", studentsRouter);
app.use("/api/report", reportRouter);
app.use("/api/auth", authRouter);
app.use("/api/cron", cronRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Invalid query parameters", details: err.flatten().fieldErrors });
    return;
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  console.error("API error:", err);
  res.status(500).json({ error: "Internal server error", message });
});

// On a persistent host (local dev, VPS, Render, …) we run a real HTTP server and
// the in-process daily cron. On Vercel (serverless) there is no long-lived
// process: `process.env.VERCEL` is set, so we skip listen()/node-cron and instead
// export the app for api/index.ts to serve as a function — the daily job is then
// driven by Vercel Cron hitting /api/cron/daily-ingest (see vercel.json).
if (!process.env.VERCEL) {
  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
    console.log(`Health check: http://localhost:${env.PORT}/api/health`);
    scheduleDailyIngest();
  });
}

export default app;
