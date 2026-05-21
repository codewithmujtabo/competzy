// Indonesian province + regency (city) data.
// Calls emsifa.com directly, same source the mobile app uses. Results are
// cached in-memory for the session so subsequent opens are instant.

const EMSIFA_BASE = 'https://www.emsifa.com/api-wilayah-indonesia/api';

export interface Province {
  code: string;
  name: string;
}

export interface Regency {
  code: string;
  name: string;
  province_code?: string;
}

let provincesCache: Province[] | null = null;
let provincesPromise: Promise<Province[]> | null = null;
const regenciesCache = new Map<string, Regency[]>();
const regenciesPromise = new Map<string, Promise<Regency[]>>();

export async function getProvinces(): Promise<Province[]> {
  if (provincesCache) return provincesCache;
  if (provincesPromise) return provincesPromise;
  provincesPromise = (async () => {
    const res = await fetch(`${EMSIFA_BASE}/provinces.json`);
    if (!res.ok) throw new Error('Failed to fetch provinces');
    const data: Array<{ id: string; name: string }> = await res.json();
    provincesCache = data.map((p) => ({ code: p.id, name: p.name }));
    return provincesCache;
  })();
  try {
    return await provincesPromise;
  } finally {
    provincesPromise = null;
  }
}

export async function getRegencies(provinceCode: string): Promise<Regency[]> {
  const cached = regenciesCache.get(provinceCode);
  if (cached) return cached;
  const inflight = regenciesPromise.get(provinceCode);
  if (inflight) return inflight;
  const p = (async () => {
    const res = await fetch(`${EMSIFA_BASE}/regencies/${provinceCode}.json`);
    if (!res.ok) throw new Error('Failed to fetch regencies');
    const data: Array<{ id: string; name: string; province_id?: string }> = await res.json();
    const regencies: Regency[] = data.map((r) => ({
      code: r.id,
      name: r.name,
      province_code: r.province_id,
    }));
    regenciesCache.set(provinceCode, regencies);
    return regencies;
  })();
  regenciesPromise.set(provinceCode, p);
  try {
    return await p;
  } finally {
    regenciesPromise.delete(provinceCode);
  }
}
