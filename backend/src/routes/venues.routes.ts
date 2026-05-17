import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/require-role";
import { audit } from "../middleware/audit";
import { liveFilter, softDelete } from "../db/query-helpers";

// Venue management API (EMC Wave 8). Areas (geographic regions) + test centers
// (physical exam venues) — global tables, no comp_id. Mounted at /api with
// path-scoped guards (this router sits at bare /api): the read paths
// `/venues/*` are admin + organizer (organizers pick a test center for a
// paper exam); the write paths `/admin/venues/*` are admin-only.

const router = Router();
router.use("/venues", authMiddleware, requireRole("admin", "organizer"));
router.use("/admin/venues", authMiddleware, requireRole("admin"));

function mapArea(r: any) {
  return {
    id: r.id,
    province: r.province,
    part: r.part ?? null,
    groupName: r.group_name ?? null,
    code: r.code ?? null,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

function mapTestCenter(r: any) {
  return {
    id: r.id,
    areaId: r.area_id ?? null,
    areaProvince: r.area_province ?? null,
    code: r.code ?? null,
    name: r.name,
    address: r.address ?? null,
    city: r.city ?? null,
    phone: r.phone ?? null,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

const trim = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

// Re-load a test center joined to its area (the INSERT/UPDATE RETURNING row
// has no area province).
async function loadTestCenter(id: string) {
  const r = await pool.query(
    `SELECT tc.id, tc.area_id, tc.code, tc.name, tc.address, tc.city, tc.phone,
            tc.is_active, tc.created_at, a.province AS area_province
       FROM test_centers tc
       LEFT JOIN areas a ON a.id = tc.area_id
      WHERE tc.id = $1`,
    [id]
  );
  return r.rows.length ? mapTestCenter(r.rows[0]) : null;
}

function pageParams(req: Request): { limit: number; offset: number; page: number } {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  return { limit, offset: (page - 1) * limit, page };
}

// ── GET /api/venues/areas ─────────────────────────────────────────────────
router.get("/venues/areas", async (req: Request, res: Response) => {
  try {
    const { limit, offset, page } = pageParams(req);
    const params: unknown[] = [];
    let where = liveFilter();
    if (req.query.search) {
      params.push(`%${String(req.query.search).trim()}%`);
      where += ` AND (province ILIKE $${params.length} OR code ILIKE $${params.length})`;
    }
    if (req.query.isActive === "true" || req.query.isActive === "false") {
      params.push(req.query.isActive === "true");
      where += ` AND is_active = $${params.length}`;
    }
    const total = await pool.query(`SELECT COUNT(*)::int n FROM areas WHERE ${where}`, params);
    params.push(limit, offset);
    const r = await pool.query(
      `SELECT id, province, part, group_name, code, is_active, created_at
         FROM areas WHERE ${where}
        ORDER BY province ASC, created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({
      areas: r.rows.map(mapArea),
      pagination: { total: total.rows[0].n, page, limit },
    });
  } catch (err) {
    console.error("List areas error:", err);
    res.status(500).json({ message: "Failed to load areas" });
  }
});

// ── GET /api/venues/test-centers ──────────────────────────────────────────
router.get("/venues/test-centers", async (req: Request, res: Response) => {
  try {
    const { limit, offset, page } = pageParams(req);
    const params: unknown[] = [];
    let where = liveFilter("tc");
    if (req.query.search) {
      params.push(`%${String(req.query.search).trim()}%`);
      where += ` AND (tc.name ILIKE $${params.length} OR tc.code ILIKE $${params.length} OR tc.city ILIKE $${params.length})`;
    }
    if (req.query.areaId) {
      params.push(String(req.query.areaId));
      where += ` AND tc.area_id = $${params.length}`;
    }
    if (req.query.isActive === "true" || req.query.isActive === "false") {
      params.push(req.query.isActive === "true");
      where += ` AND tc.is_active = $${params.length}`;
    }
    const total = await pool.query(
      `SELECT COUNT(*)::int n FROM test_centers tc WHERE ${where}`,
      params
    );
    params.push(limit, offset);
    const r = await pool.query(
      `SELECT tc.id, tc.area_id, tc.code, tc.name, tc.address, tc.city, tc.phone,
              tc.is_active, tc.created_at, a.province AS area_province
         FROM test_centers tc
         LEFT JOIN areas a ON a.id = tc.area_id
        WHERE ${where}
        ORDER BY tc.name ASC, tc.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({
      testCenters: r.rows.map(mapTestCenter),
      pagination: { total: total.rows[0].n, page, limit },
    });
  } catch (err) {
    console.error("List test centers error:", err);
    res.status(500).json({ message: "Failed to load test centers" });
  }
});

// ── POST /api/admin/venues/areas ──────────────────────────────────────────
router.post(
  "/admin/venues/areas",
  audit({ action: "area.create", resourceType: "area" }),
  async (req: Request, res: Response) => {
    try {
      const province = trim(req.body?.province);
      if (!province) {
        res.status(400).json({ message: "province is required" });
        return;
      }
      const inserted = await pool.query(
        `INSERT INTO areas (province, part, group_name, code, is_active)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, province, part, group_name, code, is_active, created_at`,
        [
          province,
          trim(req.body?.part),
          trim(req.body?.groupName),
          trim(req.body?.code),
          req.body?.isActive !== false,
        ]
      );
      res.status(201).json(mapArea(inserted.rows[0]));
    } catch (err: any) {
      if (err?.code === "23505") {
        res.status(409).json({ message: "An area with this code already exists" });
        return;
      }
      console.error("Create area error:", err);
      res.status(500).json({ message: "Failed to create area" });
    }
  }
);

// ── PUT /api/admin/venues/areas/:id ───────────────────────────────────────
router.put(
  "/admin/venues/areas/:id",
  audit({ action: "area.update", resourceType: "area", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const province = trim(req.body?.province);
      if (!province) {
        res.status(400).json({ message: "province is required" });
        return;
      }
      const updated = await pool.query(
        `UPDATE areas SET province=$1, part=$2, group_name=$3, code=$4, is_active=$5, updated_at=now()
          WHERE id=$6 AND deleted_at IS NULL
        RETURNING id, province, part, group_name, code, is_active, created_at`,
        [
          province,
          trim(req.body?.part),
          trim(req.body?.groupName),
          trim(req.body?.code),
          req.body?.isActive !== false,
          id,
        ]
      );
      if (updated.rows.length === 0) {
        res.status(404).json({ message: "Area not found" });
        return;
      }
      res.json(mapArea(updated.rows[0]));
    } catch (err: any) {
      if (err?.code === "23505") {
        res.status(409).json({ message: "An area with this code already exists" });
        return;
      }
      console.error("Update area error:", err);
      res.status(500).json({ message: "Failed to update area" });
    }
  }
);

// ── DELETE /api/admin/venues/areas/:id ────────────────────────────────────
router.delete(
  "/admin/venues/areas/:id",
  audit({ action: "area.delete", resourceType: "area", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const ok = await softDelete("areas", String(req.params.id));
      if (!ok) {
        res.status(404).json({ message: "Area not found" });
        return;
      }
      res.json({ message: "Area removed" });
    } catch (err) {
      console.error("Delete area error:", err);
      res.status(500).json({ message: "Failed to delete area" });
    }
  }
);

// ── POST /api/admin/venues/test-centers ───────────────────────────────────
router.post(
  "/admin/venues/test-centers",
  audit({ action: "test_center.create", resourceType: "test_center" }),
  async (req: Request, res: Response) => {
    try {
      const name = trim(req.body?.name);
      if (!name) {
        res.status(400).json({ message: "name is required" });
        return;
      }
      const areaId = trim(req.body?.areaId);
      if (areaId) {
        const a = await pool.query(
          "SELECT 1 FROM areas WHERE id = $1 AND deleted_at IS NULL",
          [areaId]
        );
        if (a.rows.length === 0) {
          res.status(400).json({ message: "areaId is not a known area" });
          return;
        }
      }
      const inserted = await pool.query(
        `INSERT INTO test_centers (area_id, code, name, address, city, phone, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          areaId,
          trim(req.body?.code),
          name,
          trim(req.body?.address),
          trim(req.body?.city),
          trim(req.body?.phone),
          req.body?.isActive !== false,
        ]
      );
      res.status(201).json(await loadTestCenter(inserted.rows[0].id));
    } catch (err: any) {
      if (err?.code === "23505") {
        res.status(409).json({ message: "A test center with this code already exists" });
        return;
      }
      console.error("Create test center error:", err);
      res.status(500).json({ message: "Failed to create test center" });
    }
  }
);

// ── PUT /api/admin/venues/test-centers/:id ────────────────────────────────
router.put(
  "/admin/venues/test-centers/:id",
  audit({ action: "test_center.update", resourceType: "test_center", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const name = trim(req.body?.name);
      if (!name) {
        res.status(400).json({ message: "name is required" });
        return;
      }
      const areaId = trim(req.body?.areaId);
      if (areaId) {
        const a = await pool.query(
          "SELECT 1 FROM areas WHERE id = $1 AND deleted_at IS NULL",
          [areaId]
        );
        if (a.rows.length === 0) {
          res.status(400).json({ message: "areaId is not a known area" });
          return;
        }
      }
      const updated = await pool.query(
        `UPDATE test_centers
            SET area_id=$1, code=$2, name=$3, address=$4, city=$5, phone=$6, is_active=$7, updated_at=now()
          WHERE id=$8 AND deleted_at IS NULL
        RETURNING id`,
        [
          areaId,
          trim(req.body?.code),
          name,
          trim(req.body?.address),
          trim(req.body?.city),
          trim(req.body?.phone),
          req.body?.isActive !== false,
          id,
        ]
      );
      if (updated.rows.length === 0) {
        res.status(404).json({ message: "Test center not found" });
        return;
      }
      res.json(await loadTestCenter(id));
    } catch (err: any) {
      if (err?.code === "23505") {
        res.status(409).json({ message: "A test center with this code already exists" });
        return;
      }
      console.error("Update test center error:", err);
      res.status(500).json({ message: "Failed to update test center" });
    }
  }
);

// ── DELETE /api/admin/venues/test-centers/:id ─────────────────────────────
router.delete(
  "/admin/venues/test-centers/:id",
  audit({ action: "test_center.delete", resourceType: "test_center", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const ok = await softDelete("test_centers", String(req.params.id));
      if (!ok) {
        res.status(404).json({ message: "Test center not found" });
        return;
      }
      res.json({ message: "Test center removed" });
    } catch (err) {
      console.error("Delete test center error:", err);
      res.status(500).json({ message: "Failed to delete test center" });
    }
  }
);

export default router;
