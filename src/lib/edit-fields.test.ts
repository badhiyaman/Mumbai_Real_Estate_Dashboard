import { describe, expect, it } from "vitest";
import { parseField, PROJECT_FIELDS, slugify } from "./edit-fields";

const f = (key: string) => PROJECT_FIELDS.find((x) => x.key === key)!;

describe("parseField", () => {
  it("parses numbers, allowing commas", () => {
    expect(parseField(f("total_units"), "1,250")).toEqual({ ok: true, value: 1250 });
  });
  it("rejects non-whole numbers where a count is expected", () => {
    expect(parseField(f("towers"), "2.5").ok).toBe(false);
  });
  it("rejects values outside a sensible range", () => {
    expect(parseField(f("loading_pct"), "150").ok).toBe(false);
  });
  it("treats an empty box as clearing the value", () => {
    expect(parseField(f("architect"), "  ")).toEqual({ ok: true, value: null });
  });
  it("never allows an empty name or status", () => {
    expect(parseField(f("name"), "").ok).toBe(false);
    expect(parseField(f("status"), "").ok).toBe(false);
  });
  it("only accepts listed statuses", () => {
    expect(parseField(f("status"), "sold_out").ok).toBe(false);
    expect(parseField(f("status"), "completed").ok).toBe(true);
  });
  it("reads yes / no / unknown for checkboxes", () => {
    expect(parseField(f("oc_received"), "yes")).toEqual({ ok: true, value: true });
    expect(parseField(f("oc_received"), "")).toEqual({ ok: true, value: null });
  });
  it("only accepts web links for images", () => {
    expect(parseField(f("image_url"), "javascript:alert(1)").ok).toBe(false);
  });
});

describe("slugify", () => {
  it("makes a clean web address from a name", () => {
    expect(slugify("Lodha  Bellevue (Mahalaxmi)!")).toBe("lodha-bellevue-mahalaxmi");
  });
});
