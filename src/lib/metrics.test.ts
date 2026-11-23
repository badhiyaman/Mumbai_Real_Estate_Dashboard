import { describe, expect, it } from "vitest";
import { cagr, delayMonths, growth, possessionLabel, rentalYields, typicalYield } from "./metrics";
import { price, project, rent } from "./test-fixtures";

describe("cagr", () => {
  it("doubling over 10 years is about 7.2% a year", () => {
    expect(cagr(100, 200, 10)).toBeCloseTo(0.0718, 3);
  });
  it("is hidden for spans under 2 years", () => {
    expect(cagr(100, 150, 1.5)).toBeNull();
  });
  it("rejects zero or negative prices", () => {
    expect(cagr(0, 100, 5)).toBeNull();
  });
});

describe("growth", () => {
  it("never compares carpet with saleable prices", () => {
    const g = growth([
      price("2014-01-01", 20000, { basis: "saleable" }),
      price("2016-01-01", 40000),
      price("2024-01-01", 60000),
    ]);
    expect(g?.first.price_psf).toBe(40000);
    expect(g?.last.price_psf).toBe(60000);
  });

  it("drops low-confidence asking prices when enough better data exists", () => {
    const g = growth([
      price("2016-01-01", 30000),
      price("2024-01-01", 45000),
      price("2024-06-01", 90000, { confidence: "low" }), // inflated listing
    ]);
    expect(g?.last.price_psf).toBe(45000);
  });

  it("falls back to low-confidence prices when they are all there is", () => {
    const g = growth([price("2016-01-01", 30000, { confidence: "low" }), price("2024-01-01", 45000, { confidence: "low" })]);
    expect(g?.totalPct).toBeCloseTo(0.5);
  });

  it("on the same date, ends on the most reliable price", () => {
    const g = growth([
      price("2016-01-01", 30000),
      price("2024-01-01", 50000, { confidence: "medium" }),
      price("2024-01-01", 45000, { confidence: "high" }),
    ]);
    expect(g?.last.price_psf).toBe(45000);
  });
});

describe("rental yields", () => {
  it("is yearly rent ÷ (carpet area × carpet price)", () => {
    const p = project({
      price_points: [price("2026-01-01", 50000)],
      rental_points: [rent("2026-06-01", 200000, 1000)],
    });
    // 2 lakh × 12 ÷ (1,000 × 50,000) = 4.8%
    expect(rentalYields(p)[0].grossYield).toBeCloseTo(0.048);
  });

  it("converts a saleable price only when loading is known", () => {
    const base = {
      price_points: [price("2026-01-01", 40000, { basis: "saleable" as const })],
      rental_points: [rent("2026-06-01", 200000, 1000)],
    };
    expect(rentalYields(project(base))).toHaveLength(0);
    const y = rentalYields(project({ ...base, loading_pct: 25 }))[0];
    expect(y.pricePsfCarpet).toBe(50000);
    expect(y.converted).toBe(true);
  });

  it("leaves implausible yields out of the typical figure", () => {
    const p = project({
      price_points: [price("2026-01-01", 20000)],
      rental_points: [rent("2026-06-01", 200000, 1000), rent("2026-06-01", 60000, 1000)],
    });
    // 12% (implausible) and 3.6%
    expect(typicalYield(rentalYields(p))).toBeCloseTo(0.036);
  });
});

describe("possession", () => {
  it("counts months late for delivered projects", () => {
    const p = project({ possession_promised: "2015-01-01", possession_actual: "2020-01-01", status: "completed" });
    expect(delayMonths(p)).toBe(60);
    expect(possessionLabel(p)).toBe("60 months late");
  });
  it("says 'Due' for projects not yet due", () => {
    const p = project({ possession_promised: "2099-03-01", status: "under_construction" });
    expect(possessionLabel(p)).toMatch(/^Due /);
  });
});
