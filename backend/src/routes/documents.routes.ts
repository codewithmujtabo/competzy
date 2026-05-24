import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { storeFile, deleteFile, getSignedUrl } from "../services/storage.service";

const router: Router = Router();
router.use(authMiddleware);

// ── Multer config (memory storage — works with local disk and S3) ─────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, JPG, and PNG files are allowed"));
    }
  },
});

// ── POST /api/documents/upload ────────────────────────────────────────────────
// Accepts multipart/form-data with fields: file (binary) + docType (string)
router.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const file    = req.file;
      const docType = req.body.docType as string | undefined;

      if (!file) {
        res.status(400).json({ message: "file is required" });
        return;
      }
      if (!docType) {
        res.status(400).json({ message: "docType is required" });
        return;
      }

      const ext = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext)
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase()
        .slice(0, 40);
      const filename = `${Date.now()}-${base}${ext}`;
      const fileUrl = await storeFile(req.userId!, file.buffer, filename, file.mimetype);

      const result = await pool.query(
        `INSERT INTO documents (user_id, doc_type, file_name, file_size, file_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [req.userId, docType, file.originalname, file.size, fileUrl]
      );

      res.status(201).json({
        message: "Document uploaded",
        id:      result.rows[0].id,
        fileUrl,
      });
    } catch (err: any) {
      console.error("Upload document error:", err);
      res.status(500).json({ message: err.message || "Failed to upload document" });
    }
  }
);

// ── GET /api/documents ────────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM documents WHERE user_id = $1 ORDER BY uploaded_at DESC",
      [req.userId]
    );

    // Return signed URLs (15-min expiry) so listings are not directly shareable.
    const signed = await Promise.all(
      result.rows.map(async (d) => ({
        id:         d.id,
        docType:    d.doc_type,
        fileName:   d.file_name,
        fileSize:   d.file_size,
        fileUrl:    d.file_url ? await getSignedUrl(d.file_url) : null,
        uploadedAt: d.uploaded_at,
      }))
    );
    res.json(signed);
  } catch (err) {
    console.error("List documents error:", err);
    res.status(500).json({ message: "Failed to fetch documents" });
  }
});

// ── DELETE /api/documents/:id ─────────────────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING file_url",
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    const { file_url } = result.rows[0];
    if (file_url) await deleteFile(file_url);

    res.json({ message: "Document deleted" });
  } catch (err) {
    console.error("Delete document error:", err);
    res.status(500).json({ message: "Failed to delete document" });
  }
});

export default router;
