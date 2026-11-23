import { describe, expect, it } from "vitest";
import { baseCagrFor, buildContext, combine, DEFAULT_WEIGHTS, marketBaseRates, scoreFactors, type FactorResult } from "./scoring";
import { price, project } from "./test-fixtures";
import type { Developer, MicroMarket } from "./types";

const worli: MicroMarket = {
  id: 1,
  slug: "worli",
  name: "Worli",
  region: null,
  lat: null,
  lng: null,
  catalysts: [{ name: "Metro X", type: "metro", status: "under_construction", expected_year: 2027 }],
  typical_rent_yield_pct: 4,
  rent_yield_source_url: null,
  notes: null,
};
const dev: Developer = {
  id: 1, slug: "acme", name: "Acme Ltd", founded_year: null, projects_delivered: null, delivery_track_record: null,
  on_time_score: null, website: null, listed_ticker: null, notes: null,
};

const old = project({
  slug: "old",
  micro_market: worli,
  developer: dev,
  status: "completed",
  possession_promised: "2015-01-01",
  possession_actual: "2017-01-01",
  price_points: [price("2014-01-01", 30000), price("2024-01-01", 60000)], // ~7.2%/yr
});
const fresh = project({
  slug: "fresh",
  micro_market: worli,
  developer: dev,
  status: "under_construction",
  possession_promised: "2099-01-01",
  total_units: 100,
  units_sold: 60,
  transactions_12m: 10,
  price_points: [price("2026-01-01", 45000)],
});
const ctx = buildContext([old, fresh], "2026-11-23");
const byKey = (fs: FactorResult[]) => Object.fromEntries(fs.map((f) => [f.key, f]));

describe("factors", () => {
  const f = byKey(scoreFactors(fresh, ctx));

  it("area growth uses the other projects in the area", () => {
    expect(f.area_growth.score).toBeCloseTo((0.0718 / 0.12) * 100, 0);
    expect(f.area_growth.detail).toMatch(/Other projects in Worli/);
  });
  it("a project with history isn't counted in its own area figure", () => {
    const own = byKey(scoreFactors(old, ctx));
    expect(own.area_growth.detail).toMatch(/Only this project/);
  });
  it("delivery risk falls one point per month late", () => {
    const yearAgo = new Date(Date.now() - 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const late = project({ status: "under_construction", possession_promised: yearAgo });
    expect(byKey(scoreFactors(late, buildContext([late]))).delivery_risk.score).toBeCloseTo(48, 0);
  });
  it("relative price rewards being cheaper than peers", () => {
    // 45k vs 60k peer → ratio 0.75 → (1.3 − 0.75) / 0.6 ≈ 92
    expect(f.relative_price.score).toBeCloseTo(91.7, 0);
  });
  it("developer is judged on its other projects (24-month delay)", () => {
    // delay score 100 − 24 × 1.5 = 64; growth score ≈ 60; average ≈ 62
    expect(f.developer.score).toBeCloseTo(62, 0);
  });
  it("uses the area yield when the project has no rents", () => {
    expect(f.rental_yield.score).toBeCloseTo(66.7, 0);
    expect(f.rental_yield.detail).toMatch(/Worli average/);
  });
  it("demand is the share sold", () => {
    expect(f.demand.score).toBe(60);
  });
  it("infrastructure opening soon counts the most", () => {
    expect(f.infrastructure.score).toBe(35);
  });
});

describe("combine", () => {
  it("ignores missing factors instead of counting them as zero", () => {
    const r = combine(
      [
        { key: "area_growth", score: 80, detail: "" },
        { key: "liquidity", score: null, detail: "" },
      ],
      DEFAULT_WEIGHTS,
      0.05,
    );
    expect(r.score).toBe(80);
    expect(r.coverage).toBeCloseTo(0.2);
    expect(r.confidence).toBe("thin");
  });

  it("a weight of zero switches a factor off", () => {
    const r = combine(
      [
        { key: "area_growth", score: 80, detail: "" },
        { key: "rental_yield", score: 20, detail: "" },
      ],
      { ...DEFAULT_WEIGHTS, rental_yield: 0 },
      0.05,
    );
    expect(r.score).toBe(80);
  });

  it("outlook is centred on the base rate for a score of 50, and widens with thin data", () => {
    const all = Object.keys(DEFAULT_WEIGHTS).map((k) => ({ key: k as keyof typeof DEFAULT_WEIGHTS, score: 50, detail: "" }));
    const full = combine(all, DEFAULT_WEIGHTS, 0.05).outlook!;
    expect(full.mid).toBeCloseTo(0.05);
    expect(full.high - full.low).toBeCloseTo(0.04);
    const thin = combine(all.slice(0, 1), DEFAULT_WEIGHTS, 0.05).outlook!;
    expect(thin.high - thin.low).toBeGreaterThan(full.high - full.low);
  });

  it("contribution shares add up to 100%", () => {
    const r = combine(scoreFactors(fresh, ctx), DEFAULT_WEIGHTS, 0.05);
    expect(r.contributions.reduce((a, c) => a + c.share, 0)).toBeCloseTo(1);
  });
});

describe("market base rates", () => {
  it("counts how many projects rose and beat an FD", () => {
    const r = marketBaseRates([old, fresh]);
    expect(r).toMatchObject({ count: 1, rose: 1, beatFd: 1 });
  });
});

describe("outlook starting point", () => {
  it("leans on the market median when an area has little history", () => {
    // Worli has 1 other project at ~7.2%; market median of [old] is also ~7.2%, so check the formula directly
    const lone = project({ slug: "lone", micro_market: { ...worli, slug: "nowhere", name: "Nowhere" }, price_points: [price("2016-01-01", 10000), price("2024-01-01", 5000)] });
    const c = buildContext([old, lone], "2026-11-23");
    const b = baseCagrFor(lone, c);
    // own area: only itself (≈ −8.3%/yr), market median of two ≈ (7.2 − 8.3)/2 ≈ −0.55%
    // blend = (1 × −8.3 + 3 × −0.55) / 4 ≈ −2.5%
    expect(b.value).toBeCloseTo(-0.025, 2);
    expect(b.source).toMatch(/blend/);
  });
});
