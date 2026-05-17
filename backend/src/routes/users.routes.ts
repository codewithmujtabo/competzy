import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { pool } from "../config/database";
import { upsertSchoolFromNpsn } from "../db/upsert-school";
import { authMiddleware } from "../middleware/auth";
import { storeFile } from "../services/storage.service";

const router = Router();

// All routes require auth
router.use(authMiddleware);

// ── Multer config for photo upload (memory storage — works with local disk and S3) ──
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG and PNG images are allowed"));
    }
  },
});

// ── GET /api/users/me ─────────────────────────────────────────────────────
router.get("/me", async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [req.userId]);
    if (result.rows.length === 0) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const user = result.rows[0];

    // Fetch role-specific data
    let roleData = {};
    if (user.role === "student") {
      const r = await pool.query("SELECT * FROM students WHERE id = $1", [req.userId]);
      if (r.rows.length > 0) {
        const s = r.rows[0];
        roleData = {
          // Basic
          schoolName: s.school_name,
          grade: s.grade,
          nisn: s.nisn,
          // Student details
          dateOfBirth: s.date_of_birth,
          interests: s.interests,
          referralSource: s.referral_source,
          studentCardUrl: s.student_card_url,
          // School details
          npsn: s.npsn,
          schoolAddress: s.school_address,
          schoolEmail: s.school_email,
          schoolWhatsapp: s.school_whatsapp,
          schoolPhone: s.school_phone,
          // Supervisor details
          supervisorName: s.supervisor_name,
          supervisorEmail: s.supervisor_email,
          supervisorWhatsapp: s.supervisor_whatsapp,
          supervisorPhone: s.supervisor_phone,
          supervisorSchoolId: s.supervisor_school_id,
          supervisorLinked: s.supervisor_linked,
          // Parent details
          parentName: s.parent_name,
          parentOccupation: s.parent_occupation,
          parentWhatsapp: s.parent_whatsapp,
          parentPhone: s.parent_phone,
          parentSchoolId: s.parent_school_id,
          parentLinked: s.parent_linked,
        };
      }
    } else if (user.role === "parent") {
      const r = await pool.query("SELECT * FROM parents WHERE id = $1", [req.userId]);
      if (r.rows.length > 0) {
        roleData = {
          childName: r.rows[0].child_name,
          childSchool: r.rows[0].child_school,
          childGrade: r.rows[0].child_grade,
          relationship: r.rows[0].relationship,
        };
      }
    } else if (user.role === "teacher") {
      const r = await pool.query("SELECT * FROM teachers WHERE id = $1", [req.userId]);
      if (r.rows.length > 0) {
        roleData = { school: r.rows[0].school, subject: r.rows[0].subject, department: r.rows[0].department };
      }
    }

    res.json({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      city: user.city,
      role: user.role,
      photoUrl: user.photo_url,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      ...roleData,
    });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

// ── PUT /api/users/me ─────────────────────────────────────────────────────
router.put("/me", async (req: Request, res: Response) => {
  try {
    const { fullName, phone, city, photoUrl } = req.body;

    // Update users table
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (fullName !== undefined) { fields.push(`full_name = $${idx++}`); values.push(fullName); }
    if (phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(phone); }
    if (city !== undefined) { fields.push(`city = $${idx++}`); values.push(city); }
    if (photoUrl !== undefined) { fields.push(`photo_url = $${idx++}`); values.push(photoUrl); }

    if (fields.length > 0) {
      fields.push(`updated_at = now()`);
      values.push(req.userId);
      await pool.query(
        `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx}`,
        values
      );
    }

    // Update role-specific table
    const userResult = await pool.query("SELECT role FROM users WHERE id = $1", [req.userId]);
    if (userResult.rows.length > 0) {
      const role = userResult.rows[0].role;

      if (role === "student") {
        const {
          schoolName, grade, nisn,
          dateOfBirth, interests, referralSource,
          npsn, schoolAddress, schoolEmail, schoolWhatsapp, schoolPhone,
          supervisorName, supervisorEmail, supervisorWhatsapp, supervisorPhone, supervisorSchoolId,
          parentName, parentOccupation, parentWhatsapp, parentPhone, parentSchoolId,
        } = req.body;

        const sFields: string[] = [];
        const sValues: any[] = [];
        let sIdx = 1;

        if (schoolName !== undefined) { sFields.push(`school_name = $${sIdx++}`); sValues.push(schoolName); }
        if (grade !== undefined) { sFields.push(`grade = $${sIdx++}`); sValues.push(grade); }
        if (nisn !== undefined) { sFields.push(`nisn = $${sIdx++}`); sValues.push(nisn); }
        if (dateOfBirth !== undefined) { sFields.push(`date_of_birth = $${sIdx++}`); sValues.push(dateOfBirth); }
        if (interests !== undefined) { sFields.push(`interests = $${sIdx++}`); sValues.push(interests); }
        if (referralSource !== undefined) { sFields.push(`referral_source = $${sIdx++}`); sValues.push(referralSource); }
        if (npsn !== undefined) { sFields.push(`npsn = $${sIdx++}`); sValues.push(npsn); }
        if (schoolAddress !== undefined) { sFields.push(`school_address = $${sIdx++}`); sValues.push(schoolAddress); }
        if (schoolEmail !== undefined) { sFields.push(`school_email = $${sIdx++}`); sValues.push(schoolEmail); }
        if (schoolWhatsapp !== undefined) { sFields.push(`school_whatsapp = $${sIdx++}`); sValues.push(schoolWhatsapp); }
        if (schoolPhone !== undefined) { sFields.push(`school_phone = $${sIdx++}`); sValues.push(schoolPhone); }
        if (supervisorName !== undefined) { sFields.push(`supervisor_name = $${sIdx++}`); sValues.push(supervisorName); }
        if (supervisorEmail !== undefined) { sFields.push(`supervisor_email = $${sIdx++}`); sValues.push(supervisorEmail); }
        if (supervisorWhatsapp !== undefined) { sFields.push(`supervisor_whatsapp = $${sIdx++}`); sValues.push(supervisorWhatsapp); }
        if (supervisorPhone !== undefined) { sFields.push(`supervisor_phone = $${sIdx++}`); sValues.push(supervisorPhone); }
        if (supervisorSchoolId !== undefined) { sFields.push(`supervisor_school_id = $${sIdx++}`); sValues.push(supervisorSchoolId); }
        if (parentName !== undefined) { sFields.push(`parent_name = $${sIdx++}`); sValues.push(parentName); }
        if (parentOccupation !== undefined) { sFields.push(`parent_occupation = $${sIdx++}`); sValues.push(parentOccupation); }
        if (parentWhatsapp !== undefined) { sFields.push(`parent_whatsapp = $${sIdx++}`); sValues.push(parentWhatsapp); }
        if (parentPhone !== undefined) { sFields.push(`parent_phone = $${sIdx++}`); sValues.push(parentPhone); }
        if (parentSchoolId !== undefined) { sFields.push(`parent_school_id = $${sIdx++}`); sValues.push(parentSchoolId); }

        if (sFields.length > 0) {
          sFields.push(`updated_at = now()`);
          sValues.push(req.userId);
          await pool.query(`UPDATE students SET ${sFields.join(", ")} WHERE id = $${sIdx}`, sValues);
        }

        // Keep the admin Schools directory in sync when a student sets their school.
        if (npsn !== undefined || schoolName !== undefined) {
          const sr = await pool.query(
            "SELECT npsn, school_name, school_address, school_id FROM students WHERE id = $1",
            [req.userId]
          );
          const st = sr.rows[0];
          if (st) {
            const schoolId = await upsertSchoolFromNpsn(pool, st.npsn, st.school_name, st.school_address);
            if (schoolId && !st.school_id) {
              await pool.query("UPDATE students SET school_id = $1 WHERE id = $2", [schoolId, req.userId]);
            }
          }
        }
      } else if (role === "teacher") {
        const { subject, school: teacherSchool, department } = req.body;
        const tFields: string[] = [];
        const tValues: any[] = [];
        let tIdx = 1;
        if (subject !== undefined) { tFields.push(`subject = $${tIdx++}`); tValues.push(subject); }
        if (teacherSchool !== undefined) { tFields.push(`school = $${tIdx++}`); tValues.push(teacherSchool); }
        if (department !== undefined) { tFields.push(`department = $${tIdx++}`); tValues.push(department); }
        if (tFields.length > 0) {
          tFields.push(`updated_at = now()`);
          tValues.push(req.userId);
          await pool.query(`UPDATE teachers SET ${tFields.join(", ")} WHERE id = $${tIdx}`, tValues);
        }
      }
    }

    res.json({ message: "Profile updated" });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// ── POST /api/users/photo ─────────────────────────────────────────────────────
// Upload profile photo
router.post(
  "/photo",
  photoUpload.single("photo"),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "photo file is required" });
        return;
      }

      const ext = path.extname(file.originalname);
      const filename = `profile-${Date.now()}${ext}`;
      const photoUrl = await storeFile(req.userId!, file.buffer, filename, file.mimetype);

      await pool.query(
        "UPDATE users SET photo_url = $1, updated_at = now() WHERE id = $2",
        [photoUrl, req.userId]
      );

      res.json({ message: "Photo uploaded", photoUrl });
    } catch (err: any) {
      console.error("Upload photo error:", err);
      res.status(500).json({ message: err.message || "Failed to upload photo" });
    }
  }
);

// ── POST /api/users/student-card ──────────────────────────────────────────────
// Upload student card (for students only)
router.post(
  "/student-card",
  photoUpload.single("card"),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "card file is required" });
        return;
      }

      const ext = path.extname(file.originalname);
      const filename = `card-${Date.now()}${ext}`;
      const cardUrl = await storeFile(req.userId!, file.buffer, filename, file.mimetype);

      await pool.query(
        "UPDATE students SET student_card_url = $1, updated_at = now() WHERE id = $2",
        [cardUrl, req.userId]
      );

      res.json({ message: "Student card uploaded", studentCardUrl: cardUrl });
    } catch (err: any) {
      console.error("Upload student card error:", err);
      res.status(500).json({ message: err.message || "Failed to upload student card" });
    }
  }
);

export default router;
