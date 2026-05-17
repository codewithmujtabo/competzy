import * as Sentry from "@sentry/node";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { env } from "./config/env";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  environment: process.env.NODE_ENV || "development",
  enabled: !!process.env.SENTRY_DSN,
});
import { errorHandler } from "./middleware/error-handler";
import authRoutes from "./routes/auth.routes";
import usersRoutes from "./routes/users.routes";
import registrationsRoutes from "./routes/registrations.routes";
import documentsRoutes from "./routes/documents.routes";
import competitionsRoutes from "./routes/competitions.routes";
import paymentsRoutes from "./routes/payments.routes";
import notificationsRoutes from "./routes/notifications.routes";
import parentsRoutes from "./routes/parents.routes";
import bulkRegistrationRoutes from "./routes/bulk-registration.routes";
import schoolsRoutes from "./routes/schools.routes";
import teachersRoutes from "./routes/teachers.routes";
import adminRoutes from "./routes/admin.routes";
import organizerRoutes from "./routes/organizer.routes";
import regionsRoutes from "./routes/regions.routes";
import favoritesRoutes from "./routes/favorites.routes";
import historicalRoutes from "./routes/historical.routes";
import competitionFlowsRoutes from "./routes/competition-flows.routes";
import affiliatedCredentialsRoutes from "./routes/affiliated-credentials.routes";
import questionBankRoutes from "./routes/question-bank.routes";
import examRoutes from "./routes/exam.routes";
import examSessionRoutes from "./routes/exam-session.routes";
import venuesRoutes from "./routes/venues.routes";
import commerceRoutes from "./routes/commerce.routes";
import marketingRoutes from "./routes/marketing.routes";
import { initializeCronJobs } from "./services/cron.service";
import { verifySignedUrlToken } from "./services/storage.service";
import fs from "fs";

const app = express();

// CORS: allow credentials so the web frontend can send the auth cookie.
// Origin list reads CORS_ORIGINS (comma-separated) from env, falls back to
// localhost dev hosts. In non-prod we also accept any http://localhost:<port>
// / http://127.0.0.1:<port> so devs can run Next.js on any free port without
// editing env files.
const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:3001")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const isDev = (process.env.NODE_ENV ?? "development") !== "production";
const localhostDev = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin (no Origin header — e.g. server-to-server, curl) is allowed.
      // Mobile app fetches don't send Origin either.
      if (!origin) return cb(null, true);
      if (corsOrigins.includes(origin)) return cb(null, true);
      if (isDev && localhostDev.test(origin)) return cb(null, true);
      // Reject cleanly (no `Access-Control-Allow-Origin` header) instead of
      // throwing — throwing reaches the error handler and surfaces as a
      // misleading "Internal server error" to the client.
      return cb(null, false);
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// Serve uploaded files — /uploads/<userId>/<filename>
// NOTE: This unsigned static path stays for backward-compat in dev. Production
// should rely on /uploads-signed/:token below (or S3 presigned URLs) and remove
// this static handler before launch.
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Signed-URL endpoint for local-disk dev mode. Validates a JWT token whose
// payload is the file path; tokens expire after 15 min by default.
app.get("/uploads-signed/:token", (req, res) => {
  const filePath = verifySignedUrlToken(req.params.token);
  if (!filePath) {
    res.status(403).json({ message: "Signed URL expired or invalid" });
    return;
  }
  // Path comes from a signed token we generated, but be defensive: only allow
  // files under the uploads/ directory and reject any traversal artefacts.
  const abs = path.resolve(path.join(process.cwd(), filePath));
  const root = path.resolve(path.join(process.cwd(), "uploads"));
  if (!abs.startsWith(root + path.sep)) {
    res.status(400).json({ message: "Invalid path" });
    return;
  }
  if (!fs.existsSync(abs)) {
    res.status(404).json({ message: "File not found" });
    return;
  }
  res.sendFile(abs);
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/registrations", registrationsRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/competitions", competitionsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/parents", parentsRoutes);
app.use("/api/bulk-registration", bulkRegistrationRoutes);
app.use("/api/schools", schoolsRoutes);
app.use("/api/teachers", teachersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/organizers", organizerRoutes);
app.use("/api/regions", regionsRoutes);
app.use("/api/favorites", favoritesRoutes);
app.use("/api/historical", historicalRoutes);
// Marketing — owns /marketing/* + /referrals/{click,signup} (mounted at /api).
// Mounted before the bare-/api routers that carry an unscoped authMiddleware
// (competition-flows / affiliated-credentials / exam-session) so its PUBLIC
// /referrals/click endpoint is reached before they 401 unauthenticated
// fall-through traffic.
app.use("/api", marketingRoutes);
// Step-flow engine — owns /competitions/:id/flow, /registrations/:id/flow-progress,
// and /admin/competitions/:id/flow* (mounted at /api with full sub-paths).
app.use("/api", competitionFlowsRoutes);
// Affiliated-competition credentials — owns /registrations/:id/credentials and
// /competitions/:id/credentials* (mounted at /api with full sub-paths).
app.use("/api", affiliatedCredentialsRoutes);
// Question-bank authoring — owns /question-bank/* (mounted at /api).
app.use("/api", questionBankRoutes);
// Exam blueprint + builder — owns /question-bank/exams/* (mounted at /api).
app.use("/api", examRoutes);
// Online exam attempts — owns /exams/available, /exams/:id/sessions, /sessions/* (at /api).
app.use("/api", examSessionRoutes);
// Venue management — owns /venues/* + /admin/venues/* (mounted at /api).
app.use("/api", venuesRoutes);
// Commerce — owns /commerce/* (mounted at /api).
app.use("/api", commerceRoutes);

// Sentry error handler must come before our own error handler
Sentry.setupExpressErrorHandler(app);

// Error handler
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Competzy API running on port ${env.PORT}`);

  // Initialize Sprint 4 cron jobs
  initializeCronJobs();
});

export default app;
