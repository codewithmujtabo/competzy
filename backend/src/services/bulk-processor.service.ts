import { pool } from "../config/database";
import { parse } from "csv-parse/sync";
import { hashPassword } from "./auth.service";
import { isSmtpConfigured, sendTempPasswordEmail } from "./email.service";
import crypto from "crypto";

interface CsvRow {
  full_name: string;
  email: string;
  phone: string;
  nisn: string;
  grade: string;
  competition_id: string;
  school_name?: string;
}

interface ProcessingError {
  row: number;
  error: string;
}

/**
 * Background processor for bulk registration jobs
 * Called by cron service every minute
 */
export async function processPendingJobs(): Promise<void> {
  const client = await pool.connect();
  try {
    // Find next pending job
    const jobResult = await client.query(
      `SELECT * FROM bulk_registration_jobs
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1`
    );

    if (jobResult.rows.length === 0) {
      return; // No pending jobs
    }

    const job = jobResult.rows[0];

    // Mark as processing
    await client.query(
      "UPDATE bulk_registration_jobs SET status = 'processing' WHERE id = $1",
      [job.id]
    );

    console.log(`Processing bulk job ${job.id}: ${job.file_name}`);

    // Resolve the uploader's role so we can auto-link new/matched students
    // into a teacher's roster when the uploader is a teacher (Phase 4 parity).
    const uploader = await client.query(
      "SELECT id, role FROM users WHERE id = $1",
      [job.uploaded_by],
    );
    const uploaderId: string | null = uploader.rows[0]?.id ?? null;
    const uploaderRole: string | null = uploader.rows[0]?.role ?? null;

    await processJob(job.id, job.csv_data, uploaderId, uploaderRole);
  } catch (err) {
    console.error("Error in bulk job processor:", err);
  } finally {
    client.release();
  }
}

/**
 * Process a single bulk registration job
 */
async function processJob(
  jobId: string,
  csvData: CsvRow[],
  uploaderId: string | null,
  uploaderRole: string | null,
): Promise<void> {
  const errors: ProcessingError[] = [];
  let successful = 0;

  for (let i = 0; i < csvData.length; i++) {
    const row = csvData[i];
    const rowNumber = i + 2; // +2 for header row and 1-based indexing

    try {
      await processRow(row, uploaderId, uploaderRole);
      successful++;

      // Update progress every 10 rows
      if (i % 10 === 0 || i === csvData.length - 1) {
        await pool.query(
          `UPDATE bulk_registration_jobs
           SET processed_rows = $1, successful_rows = $2
           WHERE id = $3`,
          [i + 1, successful, jobId]
        );
      }
    } catch (err: any) {
      errors.push({
        row: rowNumber,
        error: err.message || "Unknown error"
      });
    }
  }

  // Mark job as completed
  await pool.query(
    `UPDATE bulk_registration_jobs
     SET status = 'completed',
         processed_rows = $1,
         successful_rows = $2,
         failed_rows = $3,
         errors = $4,
         completed_at = now()
     WHERE id = $5`,
    [csvData.length, successful, errors.length, JSON.stringify(errors), jobId]
  );

  console.log(`Job ${jobId} completed: ${successful} successful, ${errors.length} failed`);
}

/**
 * Process a single CSV row. When the uploader is a teacher, we additionally
 * link the resulting student (newly created OR matched) into the teacher's
 * roster via teacher_student_links — Phase 4 parity, so bulk-registering
 * students through the teacher portal automatically populates the My
 * Students roster.
 */
async function processRow(
  row: CsvRow,
  uploaderId: string | null,
  uploaderRole: string | null,
): Promise<void> {
  // Validate required fields
  if (!row.full_name || !row.email || !row.competition_id) {
    throw new Error("Missing required fields: full_name, email, competition_id");
  }

  // Validate NISN format (10 digits)
  if (row.nisn && !/^\d{10}$/.test(row.nisn)) {
    throw new Error("Invalid NISN format (must be 10 digits)");
  }

  // Validate email format
  if (!row.email.includes("@")) {
    throw new Error("Invalid email format");
  }

  // Validate grade (should be a number between 1-12)
  const grade = parseInt(row.grade);
  if (row.grade && (isNaN(grade) || grade < 1 || grade > 12)) {
    throw new Error("Invalid grade (must be 1-12)");
  }

  // Track newly created user so we can email temp password after commit
  let newUserEmail: string | null = null;
  let newUserTempPassword: string | null = null;
  let newUserFullName: string | null = null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if student exists by NISN then email
    let userId: string | null = null;

    if (row.nisn) {
      const nisnCheck = await client.query(
        "SELECT id FROM students WHERE nisn = $1",
        [row.nisn]
      );
      if (nisnCheck.rows.length > 0) {
        userId = nisnCheck.rows[0].id;
      }
    }

    if (!userId) {
      const emailCheck = await client.query(
        "SELECT id FROM users WHERE email = $1 AND role = 'student'",
        [row.email.toLowerCase()]
      );
      if (emailCheck.rows.length > 0) {
        userId = emailCheck.rows[0].id;
      }
    }

    // Hard-match dedup (Spec F-ID-06): if NISN + email both miss but full_name +
    // school_name + grade all match exactly one existing student, link to them
    // instead of creating a duplicate. Skip if ambiguous (>1 match) to avoid
    // wrong attribution — operator can resolve manually.
    if (!userId && row.full_name && row.school_name && grade) {
      const hardMatch = await client.query(
        `SELECT u.id FROM users u
           JOIN students s ON s.id = u.id
          WHERE u.role = 'student'
            AND u.deleted_at IS NULL
            AND LOWER(TRIM(u.full_name)) = LOWER(TRIM($1))
            AND LOWER(TRIM(s.school)) = LOWER(TRIM($2))
            AND s.grade = $3`,
        [row.full_name, row.school_name, String(grade)]
      );
      if (hardMatch.rows.length === 1) {
        userId = hardMatch.rows[0].id;
        console.log(`[bulk-processor] hard-match link: ${row.full_name} → existing user ${userId}`);
      } else if (hardMatch.rows.length > 1) {
        throw new Error(
          `Ambiguous hard-match: ${hardMatch.rows.length} existing students matched name+school+grade. Resolve manually.`
        );
      }
    }

    // Create student if doesn't exist
    if (!userId) {
      const tempPassword = crypto.randomBytes(16).toString("hex");
      const hashedPassword = await hashPassword(tempPassword);

      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, full_name, phone, role, consent_accepted_at, consent_version)
         VALUES ($1, $2, $3, $4, 'student', now(), '1.0')
         RETURNING id`,
        [row.email.toLowerCase(), hashedPassword, row.full_name, row.phone || null]
      );
      userId = userResult.rows[0].id;

      // T3: insert school_name into students record
      await client.query(
        `INSERT INTO students (id, grade, nisn, school)
         VALUES ($1, $2, $3, $4)`,
        [userId, grade || null, row.nisn || null, row.school_name || null]
      );

      // Capture for post-commit email
      newUserEmail = row.email.toLowerCase();
      newUserTempPassword = tempPassword;
      newUserFullName = row.full_name;
    }

    // T3: Fetch competition with fee check
    const compCheck = await client.query(
      "SELECT id, reg_close_date, fee FROM competitions WHERE id = $1",
      [row.competition_id]
    );

    if (compCheck.rows.length === 0) {
      throw new Error("Competition not found");
    }

    const competition = compCheck.rows[0];

    // Check registration window
    if (competition.reg_close_date && new Date(competition.reg_close_date) < new Date()) {
      throw new Error("Competition registration is closed");
    }

    // T3: Reject bulk registration for paid competitions
    if (competition.fee > 0) {
      throw new Error(`Competition requires a fee of Rp${competition.fee.toLocaleString("id-ID")}. Bulk registration is only available for free competitions.`);
    }

    // Check duplicate registration
    const existingReg = await client.query(
      "SELECT id FROM registrations WHERE user_id = $1 AND comp_id = $2",
      [userId, row.competition_id]
    );

    if (existingReg.rows.length > 0) {
      throw new Error("Student already registered for this competition");
    }

    // T4: Atomically claim a quota slot — UPDATE returns 0 rows if competition is full
    const quotaResult = await client.query(
      `UPDATE competitions
       SET quota = quota - 1
       WHERE id = $1 AND (quota IS NULL OR quota > 0)
       RETURNING quota`,
      [row.competition_id]
    );

    if (quotaResult.rows.length === 0) {
      throw new Error("Competition is full");
    }

    // Create registration
    await client.query(
      `INSERT INTO registrations (user_id, comp_id, status)
       VALUES ($1, $2, 'registered')`,
      [userId, row.competition_id]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Auto-link to the teacher's roster when the uploader is a teacher. Runs
  // outside the registration transaction — failure here doesn't roll back
  // the registration. ON CONFLICT keeps it idempotent (safe on a resume).
  if (uploaderRole === "teacher" && uploaderId) {
    try {
      // userId is set by either the match path or the create path above; if
      // both somehow miss the row would have thrown before COMMIT.
      const studentIdResult = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND role = 'student'",
        [row.email.toLowerCase()],
      );
      const studentId: string | null = studentIdResult.rows[0]?.id ?? null;
      if (studentId) {
        await pool.query(
          `INSERT INTO teacher_student_links (teacher_id, student_id, created_at)
           VALUES ($1, $2, now())
           ON CONFLICT (teacher_id, student_id) DO NOTHING`,
          [uploaderId, studentId],
        );
      }
    } catch (linkErr) {
      console.error(`[bulk-processor] Failed to link student to teacher roster:`, linkErr);
    }
  }

  // T3: Email temp password after successful commit — failure here doesn't roll back the registration
  if (newUserEmail && newUserTempPassword && newUserFullName && isSmtpConfigured()) {
    try {
      await sendTempPasswordEmail(newUserEmail, newUserTempPassword, newUserFullName);
    } catch (emailErr) {
      console.error(`[bulk-processor] Failed to send temp password email to ${newUserEmail}:`, emailErr);
    }
  }
}

/**
 * Parse and validate CSV file contents
 */
export function parseAndValidateCsv(fileContent: string): { rows: CsvRow[], totalRows: number } {
  try {
    const rows = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as CsvRow[];

    // Validate required columns
    if (rows.length === 0) {
      throw new Error("CSV file is empty");
    }

    const requiredColumns = ['full_name', 'email', 'competition_id'];
    const firstRow = rows[0];
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));

    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    return { rows, totalRows: rows.length };
  } catch (err: any) {
    throw new Error(`CSV parsing error: ${err.message}`);
  }
}
