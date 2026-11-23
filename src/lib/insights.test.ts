import { describe, expect, it } from "vitest";
import { byArea, byDeveloper, timing } from "./insights";
import { price, project } from "./test-fixtures";
import type { Developer, MicroMarket } from "./types";

const mm = (slug: string): MicroMarket => ({
  id: 1, slug, name: slug.toUpperCase(), region: null, lat: null, lng: null, catalysts: [],
  typical_rent_yield_pct: null, rent_yield_source_url: null, notes: null,
});
const dev: Developer = {
  id: 1, slug: "acme", name: "Acme Developers (Acme Holdings Ltd)", founded_year: null, projects_delivered: null,
  delivery_track_record: null, on_time_score: null, website: null, listed_ticker: null, notes: null,
};

const a = project({
  slug: "a", name: "A", micro_market: mm("worli"), developer: dev, status: "completed",
  possession_promised: "2015-01-01", possession_actual: "2016-01-01",
  price_points: [price("2010-01-01", 10000, { stage: "launch" }), price("2015-01-01", 20000, { stage: "completion" }), price("2025-01-01", 30000)],
});
const b = project({
  slug: "b", name: "B", micro_market: mm("worli"), developer: dev,
  price_points: [price("2014-01-01", 40000), price("2024-01-01", 40000)],
});
const c = project({ slug: "c", name: "C", micro_market: mm("parel"), price_points: [price("2024-01-01", 50000)] });

describe("insights", () => {
  it("groups by area with median growth, sorted fastest first", () => {
    const rows = byArea([a, b, c]);
    expect(rows[0].key).toBe("worli");
    expect(rows[0]).toMatchObject({ projects: 2, withGrowth: 2 });
    expect(rows[0].best?.slug).toBe("a");
    expect(rows.find((r) => r.key === "parel")?.medianCagr).toBeNull();
  });
  it("groups by developer with short names and delays", () => {
    const [d] = byDeveloper([a, b, c]);
    expect(d.name).toBe("Acme Developers");
    expect(d.avgDelayMonths).toBe(12);
  });
  it("compares growth during construction with growth after completion", () => {
    const t = timing([a, b, c]);
    expect(t.rows).toHaveLength(1);
    expect(t.medianBuild).toBeCloseTo(Math.pow(2, 1 / 5) - 1, 3); // 10k → 20k in 5 years
    expect(t.medianAfter).toBeCloseTo(Math.pow(1.5, 1 / 10) - 1, 3); // 20k → 30k in 10 years
    expect(t.earlyWon).toBe(1);
  });
});
