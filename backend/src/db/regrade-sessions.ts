// Re-grade every finished online exam session — recomputes each MC period's
// points from the exam's current per-grade scoring and refreshes the session
// rollups (`corrects`/`wrongs`/`blanks`/`points`/`total_point`). Idempotent.
// Run after a scoring change, or to repair sessions graded before a
// grading-logic fix.  Usage: `npm run db:regrade`

import { pool } from "../config/database";
import {
  autoGradeMcPeriods,
  recomputeSessionRollups,
} from "../services/exam-grading.service";

async function main() {
  const r = await pool.query(
    "SELECT id FROM sessions WHERE finished_at IS NOT NULL AND deleted_at IS NULL"
  );
  console.log(`Re-grading ${r.rows.length} finished session(s)...`);
  for (const row of r.rows) {
    await autoGradeMcPeriods(pool, row.id);
    await recomputeSessionRollups(pool, row.id);
    const s = await pool.query(
      "SELECT total_point FROM sessions WHERE id = $1",
      [row.id]
    );
    console.log(`  ${row.id} → total_point ${s.rows[0].total_point}`);
  }
  console.log("Done.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
