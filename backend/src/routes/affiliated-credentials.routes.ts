import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { liveFilter, softDelete } from "../db/query-helpers";

// Affiliated-competition credentials (Wave 5 Phase 1). An affiliated
// competition hands the student off to an external site; an operator
// (organizer/admin) issues each registration a username + password the
// student carries there. Mounted at `/api`, so this router owns:
//   GET    /registrations/:id/credentials             — owner OR operator
//   GET    /competitions/:compId/credentials          — operator
//   POST   /registrations/:id/credentials             — operator: issue / update
//   POST   /competitions/:compId/credentials/bulk     — operator: bulk issue
//   DELETE /registrations/:id/credentials             — operator: revoke

const router = Router();
router.use(authMiddleware);

// Whether the requester may operate on a competition: admins always, organizers
// only on competitions they created (mirrors organizer.routes.ts ownsCompetition).
async function operatorOwnsComp(compId: string, userId: string, role: string): Promise<boolean> {
  if (role === "admin") return true;
  if (role !== "organizer") return false;
  const r = await pool.query(
    "SELECT 1 FROM competitions WHERE id = $1 AND created_by = $2",
    [compId, userId]
  );
  return r.rows.length > 0;
}

function mapCredential(r: any) {
  return {
    registrationId: r.registration_id,
    username: r.username,
    password: r.password,
    issuedAt: r.issued_at,
  };
}

// Issue or update the live credential for a registration (the partial-unique
// index on registration_id powers the upsert).
async function upsertCredential(
  registrationId: string,
  compId: string,
  username: string,
  password: string,
  issuedBy: string
) {
  const r = await pool.query(
    `INSERT INTO affiliated_credentials (registration_id, comp_id, username, password, issued_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (registration_id) WHERE deleted_at IS NULL
     DO UPDATE SET username = EXCLUDED.username,
                   password = EXCLUDED.password,
                   issued_by = EXCLUDED.issued_by,
                   updated_at = now()
     RETURNING registration_id, username, password, issued_at`,
    [registrationId, compId, username, password, issuedBy]
  );
  return r.rows[0];
}

// ── GET /api/registrations/:id/credentials ── owner OR operator ───────────
router.get("/registrations/:id/credentials", async (req: Request, res: Response) => {
  try {
    const regId = String(req.params.id);
    const reg = await pool.query(
      `SELECT r.user_id, r.comp_id, c.post_payment_redirect_url
         FROM registrations r
         JOIN competitions c ON c.id = r.comp_id
        WHERE r.id = $1 AND r.deleted_at IS NULL`,
      [regId]
    );
    if (reg.rows.length === 0) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }
    const row = reg.rows[0];
    const isOwner = row.user_id === req.userId;
    const isOperator = await operatorOwnsComp(row.comp_id, req.userId ?? "", req.userRole ?? "");
    if (!isOwner && !isOperator) {
      res.status(403).json({ message: "Not authorized for this registration" });
      return;
    }

    const cred = await pool.query(
      `SELECT registration_id, username, password, issued_at
         FROM affiliated_credentials
        WHERE registration_id = $1 AND ${liveFilter()}`,
      [regId]
    );
    res.json({
      externalUrl: row.post_payment_redirect_url ?? null,
      credential: cred.rows.length > 0 ? mapCredential(cred.rows[0]) : null,
    });
  } catch (err) {
    console.error("Get credentials error:", err);
    res.status(500).json({ message: "Failed to load credentials" });
  }
});

// ── GET /api/competitions/:compId/credentials ── operator ─────────────────
router.get("/competitions/:compId/credentials", async (req: Request, res: Response) => {
  try {
    const compId = String(req.params.compId);
    if (!(await operatorOwnsComp(compId, req.userId ?? "", req.userRole ?? ""))) {
      res.status(403).json({ message: "Not authorized for this competition" });
      return;
    }
    const rows = await pool.query(
      `SELECT registration_id, username, password, issued_at
         FROM affiliated_credentials
        WHERE comp_id = $1 AND ${liveFilter()}`,
      [compId]
    );
    res.json(rows.rows.map(mapCredential));
  } catch (err) {
    console.error("List credentials error:", err);
    res.status(500).json({ message: "Failed to load credentials" });
  }
});

// ── POST /api/registrations/:id/credentials ── operator: issue / update ───
router.post(
  "/registrations/:id/credentials",
  audit({ action: "operator.credential.issue", resourceType: "registration", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const regId = String(req.params.id);
      const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!username || !password) {
        res.status(400).json({ message: "username and password are required" });
        return;
      }
      const reg = await pool.query(
        "SELECT comp_id FROM registrations WHERE id = $1 AND deleted_at IS NULL",
        [regId]
      );
      if (reg.rows.length === 0) {
        res.status(404).json({ message: "Registration not found" });
        return;
      }
      const compId = reg.rows[0].comp_id;
      if (!(await operatorOwnsComp(compId, req.userId ?? "", req.userRole ?? ""))) {
        res.status(403).json({ message: "Not authorized for this competition" });
        return;
      }
      const saved = await upsertCredential(regId, compId, username, password, req.userId!);
      res.status(201).json(mapCredential(saved));
    } catch (err) {
      console.error("Issue credential error:", err);
      res.status(500).json({ message: "Failed to issue credential" });
    }
  }
);

// ── POST /api/competitions/:compId/credentials/bulk ── operator: bulk ─────
router.post(
  "/competitions/:compId/credentials/bulk",
  audit({ action: "operator.credential.bulk-issue", resourceType: "competition", resourceIdParam: "compId" }),
  async (req: Request, res: Response) => {
    try {
      const compId = String(req.params.compId);
      if (!(await operatorOwnsComp(compId, req.userId ?? "", req.userRole ?? ""))) {
        res.status(403).json({ message: "Not authorized for this competition" });
        return;
      }
      const rows = req.body?.rows;
      if (!Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ message: "rows must be a non-empty array" });
        return;
      }

      let issued = 0;
      const errors: { registrationNumber: string; error: string }[] = [];
      for (const row of rows) {
        const regNumber = String(row?.registrationNumber ?? "").trim();
        const username = String(row?.username ?? "").trim();
        const password = String(row?.password ?? "");
        if (!regNumber || !username || !password) {
          errors.push({ registrationNumber: regNumber || "(blank)", error: "Missing registration number, username or password" });
          continue;
        }
        const reg = await pool.query(
          `SELECT id FROM registrations
            WHERE registration_number = $1 AND comp_id = $2 AND deleted_at IS NULL`,
          [regNumber, compId]
        );
        if (reg.rows.length === 0) {
          errors.push({ registrationNumber: regNumber, error: "No matching registration in this competition" });
          continue;
        }
        await upsertCredential(reg.rows[0].id, compId, username, password, req.userId!);
        issued++;
      }
      res.json({ issued, failed: errors.length, errors });
    } catch (err) {
      console.error("Bulk issue credentials error:", err);
      res.status(500).json({ message: "Failed to bulk-issue credentials" });
    }
  }
);

// ── DELETE /api/registrations/:id/credentials ── operator: revoke ─────────
router.delete(
  "/registrations/:id/credentials",
  audit({ action: "operator.credential.revoke", resourceType: "registration", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const regId = String(req.params.id);
      const reg = await pool.query("SELECT comp_id FROM registrations WHERE id = $1", [regId]);
      if (reg.rows.length === 0) {
        res.status(404).json({ message: "Registration not found" });
        return;
      }
      if (!(await operatorOwnsComp(reg.rows[0].comp_id, req.userId ?? "", req.userRole ?? ""))) {
        res.status(403).json({ message: "Not authorized for this competition" });
        return;
      }
      const cred = await pool.query(
        `SELECT id FROM affiliated_credentials WHERE registration_id = $1 AND ${liveFilter()}`,
        [regId]
      );
      if (cred.rows.length === 0) {
        res.status(404).json({ message: "No credential to revoke" });
        return;
      }
      await softDelete("affiliated_credentials", cred.rows[0].id);
      res.json({ message: "Credential revoked" });
    } catch (err) {
      console.error("Revoke credential error:", err);
      res.status(500).json({ message: "Failed to revoke credential" });
    }
  }
);

export default router;
