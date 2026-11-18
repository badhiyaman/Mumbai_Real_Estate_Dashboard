import type { PricePoint, Project, RentalPoint, UnitType } from "./types";

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

/** Compound annual growth rate between two values over `years`. Returns null if not computable. */
export function cagr(start: number, end: number, years: number): number | null {
  if (!(start > 0) || !(end > 0) || !(years >= MIN_CAGR_YEARS)) return null;
  return Math.pow(end / start, 1 / years) - 1;
}

export function yearsBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / YEAR_MS;
}

export function sortedPrices(points: PricePoint[]): PricePoint[] {
  return [...points].sort((a, b) => a.date.localeCompare(b.date));
}

/** Yearly growth over shorter periods than this is too noisy to show. */
export const MIN_CAGR_YEARS = 2;

/**
 * Picks the price basis (carpet / saleable / unknown) that covers the longest stretch of time,
 * so growth is never computed by comparing a carpet price against a saleable one.
 * Ties go to the basis with more data points.
 */
export function dominantBasisPoints(points: PricePoint[]): PricePoint[] {
  const groups = new Map<string, PricePoint[]>();
  for (const p of points) groups.set(p.basis, [...(groups.get(p.basis) ?? []), p]);
  let best: PricePoint[] = [];
  let bestSpan = -1;
  for (const g of groups.values()) {
    const s = sortedPrices(g);
    const span = s.length > 1 ? yearsBetween(s[0].date, s[s.length - 1].date) : 0;
    if (span > bestSpan || (span === bestSpan && s.length > best.length)) {
      best = s;
      bestSpan = span;
    }
  }
  return best;
}

const CONF_RANK = { high: 0, medium: 1, low: 2 } as const;

/**
 * The points growth is measured on: one area basis (see dominantBasisPoints), and, when enough
 * better data exists, without low-confidence points. Low-confidence points are mostly listing asking
 * prices, and mixing them with registered deals makes growth look far bigger or smaller than it was.
 * Points on the same date are ordered best-confidence first.
 */
export function growthPoints(points: PricePoint[]): PricePoint[] {
  const byQuality = (xs: PricePoint[]) =>
    [...xs].sort((a, b) => a.date.localeCompare(b.date) || CONF_RANK[a.confidence] - CONF_RANK[b.confidence]);
  const good = points.filter((p) => p.confidence !== "low");
  const goodBasis = dominantBasisPoints(good);
  if (goodBasis.length >= 2 && yearsBetween(goodBasis[0].date, goodBasis[goodBasis.length - 1].date) >= MIN_CAGR_YEARS)
    return byQuality(goodBasis);
  return byQuality(dominantBasisPoints(points));
}

/** Of several points on the last date, the best-confidence one. */
function lastBest(s: PricePoint[]): PricePoint {
  const lastDate = s[s.length - 1].date;
  return s.find((p) => p.date === lastDate)!;
}

export interface Growth {
  first: PricePoint;
  last: PricePoint;
  totalPct: number;
  cagr: number | null;
  years: number;
}

export function growth(points: PricePoint[]): Growth | null {
  const same = growthPoints(points);
  if (same.length < 2) return null;
  const first = same[0];
  const last = lastBest(same);
  const years = yearsBetween(first.date, last.date);
  return {
    first,
    last,
    years,
    totalPct: last.price_psf / first.price_psf - 1,
    cagr: cagr(first.price_psf, last.price_psf, years),
  };
}

/** Growth between the last point of stage group A and the first/last of stage group B. */
export function stageGrowth(
  points: PricePoint[],
  from: PricePoint["stage"][],
  to: PricePoint["stage"][],
): Growth | null {
  const same = growthPoints(points);
  const a = same.filter((p) => from.includes(p.stage));
  const b = same.filter((p) => to.includes(p.stage));
  if (!a.length || !b.length) return null;
  const first = a[0];
  const last = lastBest(b);
  if (last.date <= first.date) return null;
  const years = yearsBetween(first.date, last.date);
  return { first, last, years, totalPct: last.price_psf / first.price_psf - 1, cagr: cagr(first.price_psf, last.price_psf, years) };
}

// ---------- rent, delay, density ----------

export interface RentYield {
  rent: RentalPoint;
  pricePsfCarpet: number; // carpet ₹/sq ft used for the yield
  price: PricePoint;
  converted: boolean; // true if a saleable price was converted to carpet using loading %
  grossYield: number; // yearly rent ÷ capital value, e.g. 0.025 = 2.5%
}

/**
 * Gross rental yield for each rent point: (monthly rent × 12) ÷ (carpet area × carpet ₹/sq ft).
 * Uses the price point closest in time (within 3 years), treating a low-confidence price as if it
 * were 1.5 years further away so better data wins when it exists. A saleable price is converted to a
 * carpet price only when the project's loading % is known.
 */
export const IMPLAUSIBLE_YIELD = 0.07; // Mumbai luxury gross yields are usually 2–5%; above this, data is likely mismatched
export function rentalYields(p: Pick<Project, "rental_points" | "price_points" | "loading_pct">): RentYield[] {
  const out: RentYield[] = [];
  for (const rent of p.rental_points ?? []) {
    if (!rent.carpet_sqft) continue;
    let best: { price: PricePoint; psf: number; converted: boolean; gap: number } | null = null;
    for (const price of p.price_points) {
      let psf: number | null = null;
      let converted = false;
      if (price.basis === "carpet") psf = price.price_psf;
      else if (price.basis === "saleable" && p.loading_pct != null) {
        psf = price.price_psf * (1 + p.loading_pct / 100);
        converted = true;
      }
      if (psf == null) continue;
      const rawGap = Math.abs(yearsBetween(price.date, rent.date));
      if (rawGap > 3) continue;
      const gap = rawGap + (price.confidence === "low" ? 1.5 : 0);
      if (!best || gap < best.gap) best = { price, psf, converted, gap };
    }
    if (!best) continue;
    out.push({
      rent,
      price: best.price,
      pricePsfCarpet: best.psf,
      converted: best.converted,
      grossYield: (rent.monthly_rent * 12) / (rent.carpet_sqft * best.psf),
    });
  }
  return out.sort((a, b) => b.rent.date.localeCompare(a.rent.date));
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Median yield, ignoring yields above IMPLAUSIBLE_YIELD (almost always an area-basis mismatch). */
export function typicalYield(ys: RentYield[]): number | null {
  return median(ys.map((y) => y.grossYield).filter((g) => g <= IMPLAUSIBLE_YIELD));
}

/** Short possession label: "On time", "14 months late", "Due Mar 2028", or null. */
export function possessionLabel(
  p: Pick<Project, "possession_promised" | "possession_actual" | "status">,
): string | null {
  const d = delayMonths(p);
  if (d == null) return null;
  if (!p.possession_actual && p.status !== "completed" && d <= 0) return `Due ${fmtDate(p.possession_promised)}`;
  return d <= 0 ? "On time" : `${d} month${d === 1 ? "" : "s"} late`;
}

/** Months between promised possession and actual (or today, if not yet delivered). Negative = early. */
export function delayMonths(p: Pick<Project, "possession_promised" | "possession_actual" | "status">): number | null {
  if (!p.possession_promised) return null;
  const end = p.possession_actual ?? (p.status === "completed" ? null : new Date().toISOString().slice(0, 10));
  if (!end) return null;
  return Math.round(yearsBetween(p.possession_promised, end) * 12);
}

export function unitsPerAcre(p: Pick<Project, "total_units" | "land_acres">): number | null {
  return p.total_units && p.land_acres ? p.total_units / p.land_acres : null;
}

export function latestPrice(points: PricePoint[]): PricePoint | null {
  const s = sortedPrices(points);
  return s.length ? s[s.length - 1] : null;
}

export function minTicketCr(units: UnitType[]): number | null {
  const vals = units.map((u) => u.price_min_cr).filter((v): v is number => v != null);
  return vals.length ? Math.min(...vals) : null;
}

export function launchYear(p: Project): number | null {
  return p.launch_date ? new Date(p.launch_date).getFullYear() : null;
}

// ---------- formatting ----------

export const fmtPsf = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}/sq ft`;
export const fmtPct = (n: number, digits = 0) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(digits)}%`;
export const fmtCr = (n: number) => `₹${n % 1 === 0 ? n : n.toFixed(1)} Cr`;
export const fmtYears = (y: number) => (y < 1 ? "<1 yr" : `${y.toFixed(y < 10 ? 1 : 0)} yrs`);

/** "Lodha Developers (Macrotech Developers Ltd)" → "Lodha Developers" */
export const shortName = (name: string) => name.replace(/\s*\(.*\)\s*$/, "").trim() || name;

/** Groups free-text unit labels like "5 BHK duplex / villa" into simple filter buckets. */
export function configBucket(config: string): string {
  const c = config.toLowerCase();
  if (/penthouse|triplex/.test(c)) return "Penthouse";
  if (/duplex|villa/.test(c)) return "Duplex";
  const bhk = c.match(/(\d)\s*bhk/);
  if (bhk) return `${bhk[1]} BHK`;
  return "Other";
}

export function fmtDate(d: string | null, precision: "day" | "month" | "year" = "month"): string {
  if (!d) return "—";
  const date = new Date(d);
  if (precision === "year") return String(date.getFullYear());
  return date.toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    ...(precision === "day" ? { day: "numeric" } : {}),
  });
}

export const STAGE_LABEL: Record<PricePoint["stage"], string> = {
  pre_launch: "Pre-launch",
  launch: "Launch",
  under_construction: "Under construction",
  completion: "Completion",
  resale: "Resale",
};

export const STATUS_LABEL: Record<Project["status"], string> = {
  completed: "Completed",
  under_construction: "Under construction",
  upcoming: "Upcoming",
};
