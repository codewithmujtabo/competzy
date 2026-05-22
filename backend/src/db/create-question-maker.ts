import { pool } from "../config/database";
import * as bcrypt from "bcrypt";

// Seed a default question-maker user — the narrow author role that can only
// reach the /question-bank/questions + /question-bank/taxonomy surfaces.
// Idempotent: if the email already exists it logs + exits cleanly so the
// command is safe to re-run on a populated dev database.
async function createQuestionMaker() {
  const email = "qm@test.local";
  const password = "Test123!";
  const fullName = "Question Maker";

  try {
    const existing = await pool.query("SELECT id, role FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      console.log("ℹ️  Question maker already exists:");
      console.log("   Email:    ", email);
      console.log("   Password: ", password);
      console.log("   Role:     ", existing.rows[0].role);
      process.exit(0);
    }

    const hash = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, consent_accepted_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, email, full_name, role`,
      [email, hash, fullName, "question_maker"],
    );

    console.log("✅ Question maker user created.");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 Email:    ", email);
    console.log("🔑 Password: ", password);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("User:", userResult.rows[0]);
    console.log("💡 Sign in at /; lands on /question-bank/questions.");
    process.exit(0);
  } catch (err: any) {
    if (err.code === "23514") {
      console.error("❌ users_role_check rejected 'question_maker'.");
      console.error("   Run the latest migrations first: npm run db:migrate");
    } else {
      console.error("❌ Failed to create question-maker:", err);
    }
    process.exit(1);
  }
}

createQuestionMaker();
