import { pool } from "../config/database";
import * as bcrypt from "bcrypt";

// Seeds the manager account — Competzy administrative staff (panitia).
// Managers get the admin portal's operational surface but no financial data
// (revenue reports, KPI money figures, refunds are admin-only).

async function createManager() {
  try {
    const email = "manager@eduversal.com";
    const password = "manager123";
    const fullName = "Manager";

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, consent_accepted_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, email, full_name, role`,
      [email, hashedPassword, fullName, "manager"]
    );

    console.log("✅ Manager user created successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 Email:    manager@eduversal.com");
    console.log("🔑 Password: manager123");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("User details:", result.rows[0]);

    process.exit(0);
  } catch (error: any) {
    if (error.code === "23505") {
      console.error("❌ Manager user already exists!");
    } else {
      console.error("❌ Error creating manager user:", error);
    }
    process.exit(1);
  }
}

createManager();
