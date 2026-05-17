import { pool } from "../config/database";
import * as bcrypt from "bcrypt";

/**
 * Seed a question_maker user — the operator role that authors exam questions
 * in the question bank (web portal at /question-bank).
 *
 *   npm run db:create-question-maker -- qmaker@test.local Test123! "Question Maker"
 */
async function createQuestionMaker() {
  try {
    const email = process.argv[2] || "qmaker@competzy.local";
    const password = process.argv[3] || "qmaker123";
    const fullName = process.argv[4] || "Question Maker";

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, consent_accepted_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, email, full_name, role`,
      [email, hashedPassword, fullName, "question_maker"]
    );

    console.log("✅ Question-maker user created successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📧 Email:    ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("User details:", result.rows[0]);

    process.exit(0);
  } catch (error: any) {
    if (error.code === "23505") {
      console.error("❌ A user with that email already exists.");
    } else {
      console.error("❌ Error creating question-maker user:", error);
    }
    process.exit(1);
  }
}

createQuestionMaker();
