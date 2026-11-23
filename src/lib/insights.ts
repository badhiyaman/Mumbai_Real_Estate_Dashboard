// Market-level lessons drawn from all projects: which areas and developers grew fastest, and
// whether buying early (at launch) beat buying a finished flat.

import { delayMonths, growth, median, rentalYields, shortName, stageGrowth, typicalYield } from "./metrics";
import { latestCarpetPsf } from "./scoring";
import type { Project } from "./types";

export interface GroupStat {
  key: string;
  name: string;
  projects: number; // projects in the group
  withGrowth: number; // projects with 2+ years of comparable prices
  medianCagr: number | null;
  medianPsf: number | null; // latest carpet ₹/sq ft
  medianYield: number | null;
  avgDelayMonths: number | null; // delivered or overdue projects only
  best: { slug: string; name: string; cagr: number } | null;
}

function group(projects: Project[], keyOf: (p: Project) => { key: string; name: string } | null): GroupStat[] {
  const groups = new Map<string, { name: string; items: Project[] }>();
  for (const p of projects) {
    const k = keyOf(p);
    if (!k) continue;
    const g = groups.get(k.key) ?? { name: k.name, items: [] };
    g.items.push(p);
    groups.set(k.key, g);
  }
  return [...groups.entries()]
    .map(([key, { name, items }]) => {
      const withCagr = items
        .map((p) => ({ p, cagr: growth(p.price_points)?.cagr ?? null }))
        .filter((x): x is { p: Project; cagr: number } => x.cagr != null);
      const delays = items
        .map((p) => ({ p, d: delayMonths(p) }))
        .filter(({ p, d }) => d != null && (p.possession_actual || d > 0))
        .map(({ d }) => Math.max(0, d!));
      const yields = items.map((p) => typicalYield(rentalYields(p))).filter((y): y is number => y != null);
      const psfs = items.map((p) => latestCarpetPsf(p.price_points)).filter((x): x is number => x != null);
      const best = withCagr.sort((a, b) => b.cagr - a.cagr)[0];
      return {
        key,
        name,
        projects: items.length,
        withGrowth: withCagr.length,
        medianCagr: median(withCagr.map((x) => x.cagr)),
        medianPsf: median(psfs),
        medianYield: median(yields),
        avgDelayMonths: delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : null,
        best: best ? { slug: best.p.slug, name: best.p.name, cagr: best.cagr } : null,
      };
    })
    .sort((a, b) => (b.medianCagr ?? -Infinity) - (a.medianCagr ?? -Infinity));
}

export const byArea = (projects: Project[]) =>
  group(projects, (p) => (p.micro_market ? { key: p.micro_market.slug, name: p.micro_market.name } : null));

export const byDeveloper = (projects: Project[]) =>
  group(projects, (p) => (p.developer ? { key: p.developer.slug, name: shortName(p.developer.name) } : null));

export interface TimingStat {
  slug: string;
  name: string;
  build: number; // yearly growth from launch to completion
  after: number | null; // yearly growth from completion to today
}

/**
 * Buy early or buy finished? For projects with prices at both launch and completion, compares the
 * yearly growth during construction with the yearly growth after completion.
 */
export function timing(projects: Project[]) {
  const rows: TimingStat[] = [];
  for (const p of projects) {
    const b = stageGrowth(p.price_points, ["pre_launch", "launch"], ["completion"]);
    if (!b || b.cagr == null) continue;
    const a = stageGrowth(p.price_points, ["completion"], ["resale"]);
    rows.push({ slug: p.slug, name: p.name, build: b.cagr, after: a?.cagr ?? null });
  }
  const pairs = rows.filter((r) => r.after != null);
  return {
    rows: rows.sort((x, y) => y.build - x.build),
    medianBuild: median(rows.map((r) => r.build)),
    medianAfter: median(pairs.map((r) => r.after!)),
    earlyWon: pairs.filter((r) => r.build > r.after!).length,
    pairs: pairs.length,
  };
}
