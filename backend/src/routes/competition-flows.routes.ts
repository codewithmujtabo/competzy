import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { adminOrManager } from "../middleware/admin.middleware";
import { audit } from "../middleware/audit";
import { liveFilter, compFilter, softDelete } from "../db/query-helpers";
import { computeCompleteness, type CompletenessResult } from "../services/readiness.service";

// The per-competition step-flow engine (Wave 4 Phase 2). `competition_flows`
// rows define an ordered sequence of steps; each step's `check_type` ties it
// to a readiness check (or `none` for an info-only milestone). The student
// dashboard renders these as a guided, gated progression.
//
// This router is mounted at `/api`, so it owns three path families:
//   GET    /competitions/:compId/flow            — the steps (auth)
//   GET    /registrations/:id/flow-progress      — steps + per-step status
//   POST   /admin/competitions/:compId/flow      — add a step       (admin)
//   PUT    /admin/competitions/:compId/flow/reorder — rewrite order (admin)
//   PUT    /admin/competitions/:compId/flow/:stepId — edit a step   (admin)
//   DELETE /admin/competitions/:compId/flow/:stepId — soft-delete   (admin)

const router: Router = Router();
router.use(authMiddleware);

const CHECK_TYPES = ["profile", "documents", "payment", "approval", "none"] as const;
type CheckType = (typeof CHECK_TYPES)[number];

interface FlowStep {
  id: string;
  stepOrder: number;
  stepKey: string;
  title: string;
  /** Bahasa Indonesia translation of `title` (Phase 4); null = use `title`. */
  titleId: string | null;
  description: string | null;
  descriptionId: string | null;
  checkType: CheckType;
  startsOn: string | null;
  endsOn: string | null;
  location: string | null;
  locationId: string | null;
}

function mapStep(r: any): FlowStep {
  return {
    id: r.id,
    stepOrder: r.step_order,
    stepKey: r.step_key,
    title: r.title,
    titleId: r.title_id ?? null,
    description: r.description ?? null,
    descriptionId: r.description_id ?? null,
    checkType: r.check_type,
    startsOn: r.starts_on ?? null,
    endsOn: r.ends_on ?? null,
    location: r.location ?? null,
    locationId: r.location_id ?? null,
  };
}

// The column list shared by every SELECT/RETURNING so the `*_id` fields are
// always present for mapStep.
const FLOW_COLS =
  "id, step_order, step_key, title, title_id, description, description_id, check_type, starts_on, ends_on, location, location_id";

function isValidCheckType(v: unknown): v is CheckType {
  return typeof v === "string" && (CHECK_TYPES as readonly string[]).includes(v);
}

async function loadFlow(compId: string): Promise<FlowStep[]> {
  const result = await pool.query(
    `SELECT ${FLOW_COLS}
       FROM competition_flows
      WHERE ${compFilter()} AND ${liveFilter()}
      ORDER BY step_order ASC`,
    [compId]
  );
  return result.rows.map(mapStep);
}

// Whether a step counts as satisfied for a given registration's readiness.
function isStepDone(checkType: CheckType, c: CompletenessResult): boolean {
  switch (checkType) {
    case "profile":   return c.checks.profileComplete.ok;
    case "documents": return c.checks.documentsUploaded.ok;
    case "payment":   return c.checks.paymentPaid.ok;
    case "approval":  return ["registered", "paid", "approved", "completed"].includes(c.status);
    case "none":      return c.status === "completed";
    default:          return false;
  }
}

// ── GET /api/competitions/:compId/flow ────────────────────────────────────
router.get("/competitions/:compId/flow", async (req: Request, res: Response) => {
  try {
    res.json(await loadFlow(String(req.params.compId)));
  } catch (err) {
    console.error("Load competition flow error:", err);
    res.status(500).json({ message: "Failed to load competition flow" });
  }
});

// ── GET /api/registrations/:id/flow-progress ──────────────────────────────
// Joins the competition's flow with the registration's readiness and labels
// each step done | current | upcoming. The first not-done step is `current`.
router.get("/registrations/:id/flow-progress", async (req: Request, res: Response) => {
  try {
    const c = await computeCompleteness(String(req.params.id));
    if (!c) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }
    if (c.userId !== req.userId && req.userRole !== "admin" && req.userRole !== "organizer") {
      res.status(403).json({ message: "Not authorized for this registration" });
      return;
    }

    const flow = await loadFlow(c.compId);
    let currentAssigned = false;
    const steps = flow.map((s) => {
      const done = isStepDone(s.checkType, c);
      let status: "done" | "current" | "upcoming";
      if (done) {
        status = "done";
      } else if (!currentAssigned) {
        status = "current";
        currentAssigned = true;
      } else {
        status = "upcoming";
      }
      return { ...s, status };
    });

    res.json({
      registrationId: c.registrationId,
      registrationStatus: c.status,
      isReady: c.isReady,
      checks: c.checks,
      steps,
    });
  } catch (err) {
    console.error("Flow progress error:", err);
    res.status(500).json({ message: "Failed to compute flow progress" });
  }
});

// ── POST /api/admin/competitions/:compId/flow ─────────────────────────────
// Append a step to the end of a competition's flow.
router.post(
  "/admin/competitions/:compId/flow",
  adminOrManager,
  audit({ action: "admin.competition.flow.create", resourceType: "competition_flow", resourceIdParam: "compId" }),
  async (req: Request, res: Response) => {
    try {
      const { compId } = req.params;
      const { stepKey, title, titleId, description, descriptionId, checkType } = req.body ?? {};

      if (!title || typeof title !== "string" || !title.trim()) {
        res.status(400).json({ message: "title is required" });
        return;
      }
      const ct: CheckType = isValidCheckType(checkType) ? checkType : "none";
      // Optional Bahasa Indonesia translations — empty string normalises to NULL
      // so the renderer falls back to the canonical (English) column.
      const norm = (v: unknown): string | null =>
        typeof v === "string" && v.trim() ? v.trim() : null;

      const comp = await pool.query("SELECT 1 FROM competitions WHERE id = $1", [compId]);
      if (comp.rows.length === 0) {
        res.status(404).json({ message: "Competition not found" });
        return;
      }

      const max = await pool.query(
        `SELECT COALESCE(MAX(step_order), 0) AS m
           FROM competition_flows WHERE ${compFilter()} AND ${liveFilter()}`,
        [compId]
      );
      const nextOrder = Number(max.rows[0].m) + 1;

      const inserted = await pool.query(
        `INSERT INTO competition_flows
           (comp_id, step_order, step_key, title, title_id, description, description_id, check_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${FLOW_COLS}`,
        [
          compId,
          nextOrder,
          (typeof stepKey === "string" && stepKey.trim()) || "custom",
          title.trim(),
          norm(titleId),
          description ?? null,
          norm(descriptionId),
          ct,
        ]
      );
      res.status(201).json(mapStep(inserted.rows[0]));
    } catch (err) {
      console.error("Create flow step error:", err);
      res.status(500).json({ message: "Failed to create flow step" });
    }
  }
);

// ── PUT /api/admin/competitions/:compId/flow/reorder ──────────────────────
// Rewrites every live step's order from an ordered array of step ids.
// Declared before /flow/:stepId so "reorder" is not captured as a step id.
router.put(
  "/admin/competitions/:compId/flow/reorder",
  adminOrManager,
  audit({ action: "admin.competition.flow.reorder", resourceType: "competition_flow", resourceIdParam: "compId" }),
  async (req: Request, res: Response) => {
    const compId = String(req.params.compId);
    const { stepIds } = req.body ?? {};
    if (!Array.isArray(stepIds) || stepIds.some((s) => typeof s !== "string")) {
      res.status(400).json({ message: "stepIds must be an array of step ids" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Two-pass to dodge the (comp_id, step_order) partial-unique index:
      // first park every step in a high range, then settle to 1..N.
      for (let i = 0; i < stepIds.length; i++) {
        await client.query(
          `UPDATE competition_flows SET step_order = $1, updated_at = now()
            WHERE id = $2 AND comp_id = $3 AND deleted_at IS NULL`,
          [10001 + i, stepIds[i], compId]
        );
      }
      for (let i = 0; i < stepIds.length; i++) {
        await client.query(
          `UPDATE competition_flows SET step_order = $1, updated_at = now()
            WHERE id = $2 AND comp_id = $3 AND deleted_at IS NULL`,
          [i + 1, stepIds[i], compId]
        );
      }
      await client.query("COMMIT");
      res.json(await loadFlow(compId));
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Reorder flow error:", err);
      res.status(500).json({ message: "Failed to reorder flow" });
    } finally {
      client.release();
    }
  }
);

// ── PUT /api/admin/competitions/:compId/flow/:stepId ──────────────────────
// Edit a step's fields (title / description / step_key / check_type).
router.put(
  "/admin/competitions/:compId/flow/:stepId",
  adminOrManager,
  audit({ action: "admin.competition.flow.update", resourceType: "competition_flow", resourceIdParam: "stepId" }),
  async (req: Request, res: Response) => {
    try {
      const { compId, stepId } = req.params;
      const { stepKey, title, titleId, description, descriptionId, location, locationId, checkType } =
        req.body ?? {};
      const norm = (v: unknown): string | null =>
        typeof v === "string" && v.trim() ? v.trim() : null;

      const sets: string[] = [];
      const values: unknown[] = [];
      let i = 1;
      if (typeof title === "string") {
        sets.push(`title = $${i++}`);
        values.push(title.trim());
      }
      if (titleId !== undefined) {
        sets.push(`title_id = $${i++}`);
        values.push(norm(titleId));
      }
      if (typeof description === "string" || description === null) {
        sets.push(`description = $${i++}`);
        values.push(description ?? null);
      }
      if (descriptionId !== undefined) {
        sets.push(`description_id = $${i++}`);
        values.push(norm(descriptionId));
      }
      if (typeof location === "string" || location === null) {
        sets.push(`location = $${i++}`);
        values.push(location ?? null);
      }
      if (locationId !== undefined) {
        sets.push(`location_id = $${i++}`);
        values.push(norm(locationId));
      }
      if (typeof stepKey === "string") {
        sets.push(`step_key = $${i++}`);
        values.push(stepKey.trim() || "custom");
      }
      if (checkType !== undefined) {
        if (!isValidCheckType(checkType)) {
          res.status(400).json({ message: "invalid checkType" });
          return;
        }
        sets.push(`check_type = $${i++}`);
        values.push(checkType);
      }
      if (sets.length === 0) {
        res.status(400).json({ message: "Nothing to update" });
        return;
      }
      sets.push(`updated_at = now()`);
      values.push(stepId, compId);

      const updated = await pool.query(
        `UPDATE competition_flows SET ${sets.join(", ")}
          WHERE id = $${i++} AND comp_id = $${i} AND deleted_at IS NULL
          RETURNING ${FLOW_COLS}`,
        values
      );
      if (updated.rows.length === 0) {
        res.status(404).json({ message: "Flow step not found" });
        return;
      }
      res.json(mapStep(updated.rows[0]));
    } catch (err) {
      console.error("Update flow step error:", err);
      res.status(500).json({ message: "Failed to update flow step" });
    }
  }
);

// ── DELETE /api/admin/competitions/:compId/flow/:stepId ───────────────────
router.delete(
  "/admin/competitions/:compId/flow/:stepId",
  adminOrManager,
  audit({ action: "admin.competition.flow.delete", resourceType: "competition_flow", resourceIdParam: "stepId" }),
  async (req: Request, res: Response) => {
    try {
      const ok = await softDelete("competition_flows", String(req.params.stepId));
      if (!ok) {
        res.status(404).json({ message: "Flow step not found" });
        return;
      }
      res.json({ message: "Flow step removed" });
    } catch (err) {
      console.error("Delete flow step error:", err);
      res.status(500).json({ message: "Failed to delete flow step" });
    }
  }
);

export default router;
