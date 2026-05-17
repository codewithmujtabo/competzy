import { pool } from "../config/database";
import * as bcrypt from "bcrypt";

/**
 * Seed one test account per non-operator role (student, parent, teacher,
 * school_admin) with a shared known password, for QA / manual testing.
 * Idempotent — re-running resets the passwords.
 *
 *   npm run db:create-test-accounts
 *
 * Operator roles have their own scripts: db:create-admin / db:create-organizer
 * / db:create-question-maker / db:create-supervisor.
 */
const PASSWORD = "Test123!";

const ACCOUNTS = [
  { email: "student@test.local", fullName: "Test Student", role: "student" },
  { email: "parent@test.local", fullName: "Test Parent", role: "parent" },
  { email: "teacher@test.local", fullName: "Test Teacher", role: "teacher" },
  { email: "schooladmin@test.local", fullName: "Test School Admin", role: "school_admin" },
];

async function createTestAccounts() {
  try {
    const hash = await bcrypt.hash(PASSWORD, 10);

    // Teacher + school_admin link to an existing (verified) school.
    const schoolRes = await pool.query(
      "SELECT id, name FROM schools ORDER BY created_at ASC LIMIT 1"
    );
    const school: { id: string; name: string } | null = schoolRes.rows[0] ?? null;

    for (const a of ACCOUNTS) {
      const schoolId = a.role === "school_admin" && school ? school.id : null;

      const ins = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role, school_id, consent_accepted_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (email) DO UPDATE
           SET password_hash = EXCLUDED.password_hash,
               role          = EXCLUDED.role,
               school_id     = EXCLUDED.school_id
         RETURNING id`,
        [a.email, hash, a.fullName, a.role, schoolId]
      );
      const userId = ins.rows[0].id;

      if (a.role === "student") {
        await pool.query(
          `INSERT INTO students (id, school_name, grade) VALUES ($1, $2, $3)
           ON CONFLICT (id) DO NOTHING`,
          [userId, school?.name ?? "Test School", "SMA"]
        );
      } else if (a.role === "parent") {
        await pool.query(
          `INSERT INTO parents (id, child_name) VALUES ($1, $2)
           ON CONFLICT (id) DO NOTHING`,
          [userId, "Test Child"]
        );
      } else if (a.role === "teacher") {
        await pool.query(
          `INSERT INTO teachers (id, school, subject) VALUES ($1, $2, $3)
           ON CONFLICT (id) DO NOTHING`,
          [userId, school?.name ?? "Test School", "Mathematics"]
        );
      }

      console.log(`✅ ${a.role.padEnd(13)} ${a.email}`);
    }

    console.log(`\n🔑 Password for all four: ${PASSWORD}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating test accounts:", error);
    process.exit(1);
  }
}

createTestAccounts();
