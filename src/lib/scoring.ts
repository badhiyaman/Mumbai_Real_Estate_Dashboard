// Investment score: a transparent, adjustable factor model.
//
// Each factor turns one kind of evidence into a 0–100 sub-score (higher = better for price growth
// or lower risk), or null when the data is missing. The overall score is the weighted average of
// the factors that have data, so missing data never counts as good or bad. It only lowers the
// "coverage" figure shown next to the score.
//
// This is an educational heuristic built on approximate public data. It is not financial advice.

import { delayMonths, growth, median, rentalYields, typicalYield, yearsBetween } from "./metrics";
import type { PricePoint, Project } from "./types";

export type FactorKey =
  | "area_growth"
  | "infrastructure"
  | "developer"
  | "relative_price"
  | "delivery_risk"
  | "rental_yield"
  | "liquidity"
  | "demand";

export interface FactorInfo {
  key: FactorKey;
  label: string;
  question: string; // what the factor asks, in plain English
}

export const FACTORS: FactorInfo[] = [
  { key: "area_growth", label: "Area price growth", question: "How fast have prices grown in this area historically?" },
  { key: "infrastructure", label: "Infrastructure coming", question: "Are big projects nearby about to open (and not fully priced in yet)?" },
  { key: "developer", label: "Developer track record", question: "Does this developer deliver on time, and have its projects appreciated?" },
  { key: "relative_price", label: "Price vs the area", question: "Is it cheaper than comparable projects nearby (more room to grow)?" },
  { key: "delivery_risk", label: "Delivery & approvals", question: "How safe is it from delays, missing approvals and complaints?" },
  { key: "rental_yield", label: "Rental yield", question: "How much rent does it earn while you hold it?" },
  { key: "liquidity", label: "Ease of resale", question: "How many flats here actually sell each year?" },
  { key: "demand", label: "Buyer demand", question: "How much of the project has already sold?" },
];

export type Weights = Record<FactorKey, number>;

export const DEFAULT_WEIGHTS: Weights = {
  area_growth: 20,
  infrastructure: 15,
  developer: 15,
  relative_price: 15,
  delivery_risk: 15, // delays tie up money with no rent and no exit, so weighted as heavily as price factors
  rental_yield: 10,
  liquidity: 5,
  demand: 5,
};

export interface FactorResult {
  key: FactorKey;
  score: number | null; // 0–100, null = no data
  detail: string; // why, in plain English
}

/** Market-wide figures that individual project scores are compared against. */
export interface ScoringContext {
  areaCagrs: Map<string, { slug: string; cagr: number }[]>; // micro-market slug → project CAGRs
  developerStats: Map<string, { cagrs: number[]; delays: number[]; projects: number }>;
  areaPrices: Map<string, { slug: string; psf: number }[]>; // latest carpet ₹/sq ft per project
  marketMedianCagr: number | null;
  today: string; // YYYY-MM-DD
}

export const FD_RATE = 0.065;

const clamp = (x: number) => Math.max(0, Math.min(100, x));
const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const inr = (x: number) => `₹${Math.round(x).toLocaleString("en-IN")}`;

/** Latest carpet ₹/sq ft, preferring medium/high-confidence prices. */
export function latestCarpetPsf(points: PricePoint[]): number | null {
  const carpet = points.filter((p) => p.basis === "carpet");
  const good = carpet.filter((p) => p.confidence !== "low");
  const pool = good.length ? good : carpet;
  if (!pool.length) return null;
  return [...pool].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!.price_psf;
}

export function buildContext(projects: Project[], today = new Date().toISOString().slice(0, 10)): ScoringContext {
  const areaCagrs = new Map<string, { slug: string; cagr: number }[]>();
  const developerStats = new Map<string, { cagrs: number[]; delays: number[]; projects: number }>();
  const areaPrices = new Map<string, { slug: string; psf: number }[]>();
  const all: number[] = [];

  for (const p of projects) {
    const c = growth(p.price_points)?.cagr ?? null;
    const area = p.micro_market?.slug;
    const dev = p.developer?.slug;
    if (c != null) {
      all.push(c);
      if (area) areaCagrs.set(area, [...(areaCagrs.get(area) ?? []), { slug: p.slug, cagr: c }]);
    }
    if (dev) {
      const s = developerStats.get(dev) ?? { cagrs: [], delays: [], projects: 0 };
      s.projects++;
      if (c != null) s.cagrs.push(c);
      const d = delayMonths(p);
      // Only count delays that are final (delivered) or already overdue.
      if (d != null && (p.possession_actual || d > 0)) s.delays.push(Math.max(0, d));
      developerStats.set(dev, s);
    }
    const psf = latestCarpetPsf(p.price_points);
    if (area && psf != null) areaPrices.set(area, [...(areaPrices.get(area) ?? []), { slug: p.slug, psf }]);
  }
  return { areaCagrs, developerStats, areaPrices, marketMedianCagr: median(all), today };
}

// ---------- individual factors ----------

/**
 * CAGRs of the area's projects, leaving this project out when others exist, so a project's own
 * history isn't counted twice. Falls back to including it when it's the only one with history.
 */
export function areaPeerCagrs(p: Project, ctx: ScoringContext): { cagrs: number[]; includesSelf: boolean } {
  const all = ctx.areaCagrs.get(p.micro_market?.slug ?? "") ?? [];
  const others = all.filter((x) => x.slug !== p.slug);
  if (others.length) return { cagrs: others.map((x) => x.cagr), includesSelf: false };
  return { cagrs: all.map((x) => x.cagr), includesSelf: all.length > 0 };
}

function areaGrowth(p: Project, ctx: ScoringContext): FactorResult {
  const name = p.micro_market?.name ?? "this area";
  const { cagrs, includesSelf } = areaPeerCagrs(p, ctx);
  const m = median(cagrs);
  if (m == null) return { key: "area_growth", score: null, detail: `No projects in ${name} with 2+ years of price history yet.` };
  const n = cagrs.length;
  return {
    key: "area_growth",
    // 0%/yr → 0, 12%/yr or more → 100
    score: clamp((m / 0.12) * 100),
    detail: includesSelf
      ? `Only this project has 2+ years of prices in ${name}: ${pct(m)}/yr.`
      : `Other projects in ${name} grew a median ${pct(m)}/yr (${n} project${n === 1 ? "" : "s"}).`,
  };
}

function infrastructure(p: Project, ctx: ScoringContext): FactorResult {
  const cats = p.micro_market?.catalysts ?? [];
  if (!cats.length) return { key: "infrastructure", score: null, detail: "No infrastructure projects recorded for this area." };
  const year = +ctx.today.slice(0, 4);
  let points = 0;
  const upcoming: string[] = [];
  for (const c of cats) {
    const y = c.expected_year;
    if (c.status === "under_construction") {
      points += y != null && y - year <= 3 ? 35 : 25; // opening soon = biggest effect still to come
      upcoming.push(`${c.name}${y ? ` (${y})` : ""}`);
    } else if (c.status === "planned") {
      points += 12;
      upcoming.push(`${c.name} (planned)`);
    } else if (y != null && year - y <= 2) {
      points += 12; // opened recently: partly priced in
    } else {
      points += 4; // long open: mostly priced in
    }
  }
  return {
    key: "infrastructure",
    score: clamp(points),
    detail: upcoming.length
      ? `Still to open: ${upcoming.slice(0, 3).join("; ")}${upcoming.length > 3 ? ` and ${upcoming.length - 3} more` : ""}.`
      : `${cats.length} nearby project${cats.length === 1 ? " is" : "s are"} already open, so most of the effect is likely priced in.`,
  };
}

function developer(p: Project, ctx: ScoringContext): FactorResult {
  const dev = p.developer;
  if (!dev) return { key: "developer", score: null, detail: "Developer unknown." };
  // Use the developer's OTHER projects so a project isn't judged on itself.
  const others = { cagrs: [] as number[], delays: [] as number[] };
  const self = growth(p.price_points)?.cagr;
  const s = ctx.developerStats.get(dev.slug);
  if (s) {
    others.cagrs = [...s.cagrs];
    const selfIdx = self != null ? others.cagrs.indexOf(self) : -1;
    if (selfIdx >= 0) others.cagrs.splice(selfIdx, 1);
    others.delays = [...s.delays];
    const selfDelay = delayMonths(p);
    if (selfDelay != null && (p.possession_actual || selfDelay > 0)) {
      const i = others.delays.indexOf(Math.max(0, selfDelay));
      if (i >= 0) others.delays.splice(i, 1);
    }
  }
  const parts: number[] = [];
  const why: string[] = [];
  const avgDelay = others.delays.length ? others.delays.reduce((a, b) => a + b, 0) / others.delays.length : null;
  if (avgDelay != null) {
    parts.push(clamp(100 - avgDelay * 1.5)); // 0 months → 100, 66+ months → 0
    why.push(`average delay ${Math.round(avgDelay)} months across ${others.delays.length} other project${others.delays.length === 1 ? "" : "s"}`);
  }
  const mc = median(others.cagrs);
  if (mc != null) {
    parts.push(clamp((mc / 0.12) * 100));
    why.push(`other projects grew a median ${pct(mc)}/yr`);
  }
  if (dev.on_time_score != null) {
    parts.push(dev.on_time_score);
    why.push(`on-time rating ${dev.on_time_score}/100`);
  }
  if (!parts.length) return { key: "developer", score: null, detail: `No other ${dev.name.split(" (")[0]} projects with delivery or price history in the data.` };
  return {
    key: "developer",
    score: parts.reduce((a, b) => a + b, 0) / parts.length,
    detail: `${dev.name.split(" (")[0]}: ${why.join("; ")}.`,
  };
}

function relativePrice(p: Project, ctx: ScoringContext): FactorResult {
  const own = latestCarpetPsf(p.price_points);
  const name = p.micro_market?.name ?? "the area";
  if (own == null) return { key: "relative_price", score: null, detail: "No carpet-area price to compare." };
  const peers = (ctx.areaPrices.get(p.micro_market?.slug ?? "") ?? []).filter((x) => x.slug !== p.slug).map((x) => x.psf);
  const m = median(peers);
  if (m == null) return { key: "relative_price", score: null, detail: `No other ${name} projects with a carpet price to compare against.` };
  const ratio = own / m;
  return {
    key: "relative_price",
    // 30% cheaper than peers → 100, same price → 50, 30% dearer → 0
    score: clamp(((1.3 - ratio) / 0.6) * 100),
    detail: `${inr(own)}/sq ft carpet vs a ${name} median of ${inr(m)} (${ratio >= 1 ? "+" : ""}${pct(ratio - 1, 0)}; ${peers.length} other project${peers.length === 1 ? "" : "s"}).`,
  };
}

function deliveryRisk(p: Project): FactorResult {
  let score: number;
  const why: string[] = [];
  const d = delayMonths(p);
  if (p.status === "completed") {
    if (p.oc_received === false) {
      score = 45;
      why.push("built, but no full occupation certificate (OC) yet");
    } else if (p.oc_received) {
      score = 90;
      why.push("completed with an occupation certificate");
    } else {
      score = 75;
      why.push("completed; OC status not confirmed");
    }
  } else if (p.status === "under_construction") {
    score = 60;
    if (d != null && d > 0) {
      score -= Math.min(60, d); // 1 point per month late: 5 years late → 0
      why.push(`under construction and ${d} months past the promised date`);
    } else why.push("under construction, within its promised timeline so far");
  } else {
    score = 45;
    why.push("not launched or very early: approvals and timelines can still slip");
  }
  if (p.rera_complaints) {
    score -= Math.min(20, p.rera_complaints);
    why.push(`${p.rera_complaints} MahaRERA complaint${p.rera_complaints === 1 ? "" : "s"}`);
  }
  return { key: "delivery_risk", score: clamp(score), detail: `${why.join("; ")}.`.replace(/^./, (c) => c.toUpperCase()) };
}

function rentalYieldFactor(p: Project): FactorResult {
  const own = typicalYield(rentalYields(p));
  const area = p.micro_market?.typical_rent_yield_pct != null ? p.micro_market.typical_rent_yield_pct / 100 : null;
  const y = own ?? area;
  if (y == null) return { key: "rental_yield", score: null, detail: "No rent data for this project or area." };
  return {
    key: "rental_yield",
    // 2% → 0, 5% or more → 100
    score: clamp(((y - 0.02) / 0.03) * 100),
    detail: own != null
      ? `About ${pct(y)} gross from this project's rents (bank FD: ${pct(FD_RATE)}).`
      : `No rents for this project yet; using the ${p.micro_market?.name} average of ${pct(y)}.`,
  };
}

function liquidity(p: Project): FactorResult {
  if (p.transactions_12m == null) return { key: "liquidity", score: null, detail: "Number of recent resales not known." };
  const t = p.transactions_12m;
  return {
    key: "liquidity",
    score: clamp((t / 20) * 100), // 20+ registered sales a year → 100
    detail: `${t} registered sale${t === 1 ? "" : "s"} in the last 12 months.`,
  };
}

function demand(p: Project): FactorResult {
  if (p.status === "completed") return { key: "demand", score: null, detail: "Completed project: sales pace no longer applies." };
  if (p.units_sold == null || !p.total_units) return { key: "demand", score: null, detail: "Units sold not known." };
  const share = p.units_sold / p.total_units;
  const age = p.launch_date ? yearsBetween(p.launch_date, p.units_sold_as_of ?? new Date().toISOString()) : null;
  return {
    key: "demand",
    score: clamp(share * 100),
    detail: `${Math.round(share * 100)}% sold (${p.units_sold} of ${p.total_units})${age != null && age > 0 ? ` about ${age.toFixed(1)} years after launch` : ""}.`,
  };
}

export function scoreFactors(p: Project, ctx: ScoringContext): FactorResult[] {
  return [
    areaGrowth(p, ctx),
    infrastructure(p, ctx),
    developer(p, ctx),
    relativePrice(p, ctx),
    deliveryRisk(p),
    rentalYieldFactor(p),
    liquidity(p),
    demand(p),
  ];
}

// ---------- combining (runs in the browser too, so weights can change live) ----------

export interface Outlook {
  base: number; // starting yearly growth assumption
  low: number; // yearly growth, pessimistic
  mid: number;
  high: number; // yearly growth, optimistic
  horizons: { years: number; low: number; mid: number; high: number }[]; // total % change
  verdict: string;
}

export interface ScoreResult {
  score: number | null;
  coverage: number; // 0–1: share of total weight that had data
  confidence: "good" | "fair" | "thin";
  contributions: { key: FactorKey; score: number; weight: number; share: number }[]; // share of the final score
  outlook: Outlook | null;
}

/**
 * Combines factor scores with weights. Outlook: start from the area's historical yearly growth
 * (or the whole market's), nudge it up to ±3 percentage points by the score, and widen the range
 * when less data is available.
 */
export function combine(
  factors: FactorResult[],
  weights: Weights,
  baseCagr: number | null,
): ScoreResult {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const used = factors.filter((f) => f.score != null && weights[f.key] > 0);
  const usedWeight = used.reduce((a, f) => a + weights[f.key], 0);
  const coverage = total > 0 ? usedWeight / total : 0;
  const confidence = coverage >= 0.75 ? "good" : coverage >= 0.5 ? "fair" : "thin";
  if (!usedWeight) return { score: null, coverage, confidence: "thin", contributions: [], outlook: null };

  const score = used.reduce((a, f) => a + f.score! * weights[f.key], 0) / usedWeight;
  const contributions = used.map((f) => ({
    key: f.key,
    score: f.score!,
    weight: weights[f.key],
    share: (f.score! * weights[f.key]) / usedWeight / Math.max(score, 1e-9),
  }));

  let outlook: Outlook | null = null;
  if (baseCagr != null) {
    const mid = baseCagr + ((score - 50) / 50) * 0.03;
    const spread = 0.02 + (1 - coverage) * 0.04;
    const low = mid - spread;
    const high = mid + spread;
    const grow = (r: number, n: number) => Math.pow(1 + r, n) - 1;
    const verdict =
      low > FD_RATE
        ? "Likely to beat a bank FD, if past patterns hold"
        : mid > FD_RATE
          ? "Could beat a bank FD, but it's far from certain"
          : low > 0
            ? "Likely to rise, but probably slower than a bank FD"
            : mid > 0
              ? "More likely to rise than fall, with real risk of a flat or lower price"
              : "Weak outlook: past data points to flat or falling prices";
    outlook = {
      base: baseCagr,
      low,
      mid,
      high,
      horizons: [3, 5, 7].map((n) => ({ years: n, low: grow(low, n), mid: grow(mid, n), high: grow(high, n) })),
      verdict,
    };
  }
  return { score, coverage, confidence, contributions, outlook };
}

/** How many "virtual" all-Mumbai projects an area's figure is blended with. */
export const MARKET_PRIOR_WEIGHT = 3;

/**
 * The yearly-growth starting point for a project's outlook. An area with only one or two projects
 * of history is mostly noise, so the area median is blended with the all-Mumbai median:
 * (n × area + 3 × market) ÷ (n + 3). With 1 project the market dominates; with 10 the area does.
 */
export function baseCagrFor(p: Project, ctx: ScoringContext): { value: number | null; source: string } {
  const { cagrs } = areaPeerCagrs(p, ctx);
  const area = median(cagrs);
  const market = ctx.marketMedianCagr;
  const name = p.micro_market?.name ?? "area";
  if (area == null) return { value: market, source: "all-Mumbai median (no area history yet)" };
  if (market == null) return { value: area, source: `${name} median` };
  const n = cagrs.length;
  const value = (n * area + MARKET_PRIOR_WEIGHT * market) / (n + MARKET_PRIOR_WEIGHT);
  return {
    value,
    source: `blend of the ${name} median (${pct(area)}/yr from ${n} project${n === 1 ? "" : "s"}) and the all-Mumbai median (${pct(market)}/yr), giving`,
  };
}

/** How the projects in the data have actually done: a reality check for any score. */
export function marketBaseRates(projects: Project[]) {
  const cagrs = projects.map((p) => growth(p.price_points)?.cagr).filter((c): c is number => c != null);
  return {
    count: cagrs.length,
    rose: cagrs.filter((c) => c > 0).length,
    beatFd: cagrs.filter((c) => c > FD_RATE).length,
    median: median(cagrs),
  };
}
