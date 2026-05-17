import { pool } from "../config/database";
import * as bcrypt from "bcrypt";

/**
 * Seed a supervisor user — the operator role that runs test centers and
 * proctoring. The supervisor's web surface lands in Wave 4; for now this role
 * exists so the schema and middleware are ready.
 *
 *   npm run db:create-supervisor -- supervisor@test.local Test123! "Supervisor"
 */
async function createSupervisor() {
  try {
    const email = process.argv[2] || "supervisor@competzy.local";
    const password = process.argv[3] || "supervisor123";
    const fullName = process.argv[4] || "Supervisor";

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, consent_accepted_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, email, full_name, role`,
      [email, hashedPassword, fullName, "supervisor"]
    );

    console.log("✅ Supervisor user created successfully!");
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
      console.error("❌ Error creating supervisor user:", error);
    }
    process.exit(1);
  }
}

createSupervisor();
