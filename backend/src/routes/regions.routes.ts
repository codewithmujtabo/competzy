import { Router, Request, Response } from "express";
import fetch from "node-fetch";

const router: Router = Router();

interface Province {
  code: string;
  name: string;
}

interface Regency {
  code: string;
  name: string;
  province_code: string;
}

/**
 * GET /api/regions/provinces
 * Fetches list of Indonesian provinces
 */
router.get("/provinces", async (req: Request, res: Response) => {
  try {
    const response = await fetch("https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json");

    if (!response.ok) {
      throw new Error("Failed to fetch provinces");
    }

    const data: any[] = await response.json();

    // Normalize to our format
    const provinces: Province[] = data.map((p) => ({
      code: p.id,
      name: p.name,
    }));

    res.json({ data: provinces });
  } catch (err: any) {
    console.error("Provinces fetch error:", err);
    res.status(500).json({
      message: "Failed to fetch provinces",
      error: err.message
    });
  }
});

/**
 * GET /api/regions/regencies/:provinceCode
 * Fetches list of cities/regencies for a given province
 */
router.get("/regencies/:provinceCode", async (req: Request, res: Response) => {
  try {
    const { provinceCode } = req.params;

    if (!provinceCode) {
      res.status(400).json({ message: "provinceCode is required" });
      return;
    }

    const response = await fetch(
      `https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${provinceCode}.json`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch regencies");
    }

    const data: any[] = await response.json();

    // Normalize to our format
    const regencies: Regency[] = data.map((r) => ({
      code: r.id,
      name: r.name,
      province_code: r.province_id,
    }));

    res.json({ data: regencies });
  } catch (err: any) {
    console.error("Regencies fetch error:", err);
    res.status(500).json({
      message: "Failed to fetch regencies",
      error: err.message
    });
  }
});

export default router;
