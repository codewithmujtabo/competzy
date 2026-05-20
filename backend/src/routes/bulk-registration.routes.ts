import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { bulkUploadLimiter } from "../middleware/rate-limit";
import multer from "multer";
import { parseAndValidateCsv } from "../services/bulk-processor.service";

const router = Router();

// Configure multer for file upload (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Authorization middleware for teachers and school admins
function teacherOrAdminOnly(req: Request, res: Response, next: Function) {
  if (!req.userRole || !['teacher', 'school_admin'].includes(req.userRole)) {
    res.status(403).json({ message: "Only teachers and school admins can upload bulk registrations" });
    return;
  }
  next();
}

// ── POST /api/bulk-registration/upload ───────────────────────────────────
// Upload CSV file for bulk registration
router.post("/upload", authMiddleware, bulkUploadLimiter, teacherOrAdminOnly, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const uploaderId = req.userId!;

    if (!req.file) {
      res.status(400).json({ message: "CSV file is required" });
      return;
    }

    const fileContent = req.file.buffer.toString('utf-8');
    const fileName = req.file.originalname;

    // Parse and validate CSV
    let csvData;
    let totalRows;
    try {
      const parsed = parseAndValidateCsv(fileContent);
      csvData = parsed.rows;
      totalRows = parsed.totalRows;
    } catch (err: any) {
      res.status(400).json({ message: err.message });
      return;
    }

    // Create job record
    const result = await pool.query(
      `INSERT INTO bulk_registration_jobs (uploaded_by, file_name, total_rows, csv_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id, status, total_rows, created_at`,
      [uploaderId, fileName, totalRows, JSON.stringify(csvData)]
    );

    const job = result.rows[0];

    res.status(201).json({
      jobId: job.id,
      fileName: fileName,
      totalRows: job.total_rows,
      status: job.status,
      createdAt: job.created_at,
      message: "CSV uploaded successfully. Processing will begin shortly."
    });
  } catch (err: any) {
    console.error("Bulk upload error:", err);
    res.status(500).json({ message: err.message || "Failed to upload CSV" });
  }
});

// ── POST /api/bulk-registration/manual ───────────────────────────────────
// Inline / Excel-paste manual entry — a structured alternative to CSV upload
// when a teacher just has a handful of students to register. Body shape:
//   { compId: string, rows: [{ fullName, email, phone?, nisn?, grade?, schoolName? }, ...] }
// Server-side: validates every row (full_name + email required, email format),
// transforms to the same envelope shape the cron expects, and inserts a single
// `bulk_registration_jobs` record. The existing bulk-processor cron then picks
// it up — no other backend changes needed.
router.post(
  "/manual",
  authMiddleware,
  bulkUploadLimiter,
  teacherOrAdminOnly,
  async (req: Request, res: Response) => {
    try {
      const uploaderId = req.userId!;
      const { compId, rows } = req.body as {
        compId?: string;
        rows?: Array<{
          fullName?: string;
          email?: string;
          phone?: string;
          nisn?: string;
          grade?: string;
          schoolName?: string;
        }>;
      };

      if (!compId || typeof compId !== "string") {
        res.status(400).json({ message: "compId is required" });
        return;
      }
      if (!Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ message: "At least one student row is required" });
        return;
      }
      if (rows.length > 500) {
        res.status(400).json({ message: "Maximum 500 students per submission" });
        return;
      }

      // Verify the competition exists. Catches typos / stale UI state cheaply
      // before we wedge a doomed job into the queue.
      const compCheck = await pool.query(
        "SELECT 1 FROM competitions WHERE id = $1",
        [compId],
      );
      if (compCheck.rows.length === 0) {
        res.status(400).json({ message: "Competition not found" });
        return;
      }

      const errors: Array<{ row: number; error: string }> = [];
      const csvData = rows.map((r, i) => {
        const rowNum = i + 1;
        const fullName = String(r.fullName ?? "").trim();
        const email = String(r.email ?? "").trim().toLowerCase();
        if (!fullName) errors.push({ row: rowNum, error: "Full name is required" });
        if (!email) errors.push({ row: rowNum, error: "Email is required" });
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push({ row: rowNum, error: `Invalid email: ${email}` });
        }
        return {
          full_name: fullName,
          email,
          phone: String(r.phone ?? "").trim(),
          nisn: String(r.nisn ?? "").trim(),
          grade: String(r.grade ?? "").trim(),
          school_name: String(r.schoolName ?? "").trim(),
          competition_id: compId,
        };
      });

      if (errors.length > 0) {
        res.status(400).json({
          message: `Invalid rows: ${errors.length} of ${rows.length}`,
          errors,
        });
        return;
      }

      const result = await pool.query(
        `INSERT INTO bulk_registration_jobs (uploaded_by, file_name, total_rows, csv_data)
         VALUES ($1, $2, $3, $4)
         RETURNING id, status, total_rows, created_at`,
        [
          uploaderId,
          `manual-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.csv`,
          csvData.length,
          JSON.stringify(csvData),
        ],
      );

      const job = result.rows[0];
      res.status(201).json({
        jobId: job.id,
        fileName: `manual entry · ${csvData.length} students`,
        totalRows: job.total_rows,
        status: job.status,
        createdAt: job.created_at,
        message: "Students queued for processing.",
      });
    } catch (err: any) {
      console.error("Bulk manual entry error:", err);
      res.status(500).json({ message: err.message || "Failed to submit students" });
    }
  },
);

// ── GET /api/bulk-registration/jobs/:jobId ───────────────────────────────
// Get job status and progress
router.get("/jobs/:jobId", authMiddleware, teacherOrAdminOnly, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const uploaderId = req.userId!;

    const result = await pool.query(
      `SELECT
        id,
        file_name,
        total_rows,
        processed_rows,
        successful_rows,
        failed_rows,
        status,
        errors,
        created_at,
        completed_at
       FROM bulk_registration_jobs
       WHERE id = $1 AND uploaded_by = $2`,
      [jobId, uploaderId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "Job not found" });
      return;
    }

    const job = result.rows[0];

    res.json({
      id: job.id,
      fileName: job.file_name,
      status: job.status,
      totalRows: job.total_rows,
      processedRows: job.processed_rows || 0,
      successfulRows: job.successful_rows || 0,
      failedRows: job.failed_rows || 0,
      errors: job.errors || [],
      createdAt: job.created_at,
      completedAt: job.completed_at,
      progress: job.total_rows > 0 ? Math.round((job.processed_rows || 0) / job.total_rows * 100) : 0
    });
  } catch (err) {
    console.error("Get job error:", err);
    res.status(500).json({ message: "Failed to fetch job status" });
  }
});

// ── GET /api/bulk-registration/jobs ──────────────────────────────────────
// List all jobs for the current user
router.get("/jobs", authMiddleware, teacherOrAdminOnly, async (req: Request, res: Response) => {
  try {
    const uploaderId = req.userId!;

    const result = await pool.query(
      `SELECT
        id,
        file_name,
        total_rows,
        processed_rows,
        successful_rows,
        failed_rows,
        status,
        created_at,
        completed_at
       FROM bulk_registration_jobs
       WHERE uploaded_by = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [uploaderId]
    );

    res.json(result.rows.map(job => ({
      id: job.id,
      fileName: job.file_name,
      status: job.status,
      totalRows: job.total_rows,
      processedRows: job.processed_rows || 0,
      successfulRows: job.successful_rows || 0,
      failedRows: job.failed_rows || 0,
      createdAt: job.created_at,
      completedAt: job.completed_at,
      progress: job.total_rows > 0 ? Math.round((job.processed_rows || 0) / job.total_rows * 100) : 0
    })));
  } catch (err) {
    console.error("List jobs error:", err);
    res.status(500).json({ message: "Failed to fetch jobs" });
  }
});

export default router;
