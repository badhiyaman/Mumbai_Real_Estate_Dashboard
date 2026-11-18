import type { PricePoint, Project, UnitType } from "./types";

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

/** Compound annual growth rate between two values over `years`. Returns null if not computable. */
export function cagr(start: number, end: number, years: number): number | null {
  if (!(start > 0) || !(end > 0) || !(years > 0.25)) return null;
  return Math.pow(end / start, 1 / years) - 1;
}

export function yearsBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / YEAR_MS;
}

export function sortedPrices(points: PricePoint[]): PricePoint[] {
  return [...points].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Picks the price basis (carpet / saleable) with the most data points, so growth is
 * never computed by comparing a carpet price against a saleable one.
 */
export function dominantBasisPoints(points: PricePoint[]): PricePoint[] {
  const groups = new Map<string, PricePoint[]>();
  for (const p of points) groups.set(p.basis, [...(groups.get(p.basis) ?? []), p]);
  let best: PricePoint[] = [];
  for (const g of groups.values()) if (g.length > best.length) best = g;
  return sortedPrices(best);
}

export interface Growth {
  first: PricePoint;
  last: PricePoint;
  totalPct: number;
  cagr: number | null;
  years: number;
}

export function growth(points: PricePoint[]): Growth | null {
  const same = dominantBasisPoints(points);
  if (same.length < 2) return null;
  const first = same[0];
  const last = same[same.length - 1];
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
  const same = dominantBasisPoints(points);
  const a = same.filter((p) => from.includes(p.stage));
  const b = same.filter((p) => to.includes(p.stage));
  if (!a.length || !b.length) return null;
  const first = a[0];
  const last = b[b.length - 1];
  if (last.date <= first.date) return null;
  const years = yearsBetween(first.date, last.date);
  return { first, last, years, totalPct: last.price_psf / first.price_psf - 1, cagr: cagr(first.price_psf, last.price_psf, years) };
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
