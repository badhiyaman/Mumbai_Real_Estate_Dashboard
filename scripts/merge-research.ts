// Merges developer and micro-market details from data/seed/_research/*.json
// into data/seed/developers.json and data/seed/micro_markets.json.
// Existing entries are kept; new facts only fill in blanks, and catalysts are combined by name.
// Run with: npm run merge-research

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SeedDeveloper, SeedMicroMarket } from "../src/lib/seed-types";

const dir = join(process.cwd(), "data", "seed");
const researchDir = join(dir, "_research");
const load = <T>(p: string, fallback: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : fallback);

function fillBlanks<T extends object>(base: T, extra: T): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(extra)) {
    const cur = out[k];
    if (cur === undefined || cur === null || cur === "") out[k] = v;
  }
  return out as T;
}

const devs = new Map(load<SeedDeveloper[]>(join(dir, "developers.json"), []).map((d) => [d.slug, d]));
const mms = new Map(load<SeedMicroMarket[]>(join(dir, "micro_markets.json"), []).map((m) => [m.slug, m]));

const files = existsSync(researchDir) ? readdirSync(researchDir).filter((f) => f.endsWith(".json")).sort() : [];
for (const f of files) {
  const batch = load<{ developers?: SeedDeveloper[]; micro_markets?: SeedMicroMarket[] }>(join(researchDir, f), {});
  for (const d of batch.developers ?? []) devs.set(d.slug, devs.has(d.slug) ? fillBlanks(devs.get(d.slug)!, d) : d);
  for (const m of batch.micro_markets ?? []) {
    const cur = mms.get(m.slug);
    if (!cur) {
      mms.set(m.slug, m);
      continue;
    }
    const merged = fillBlanks(cur, m);
    const names = new Set(cur.catalysts.map((c) => c.name.toLowerCase()));
    merged.catalysts = [...cur.catalysts, ...m.catalysts.filter((c) => !names.has(c.name.toLowerCase()))];
    mms.set(m.slug, merged);
  }
}

const sortBySlug = <T extends { slug: string }>(xs: Iterable<T>) => [...xs].sort((a, b) => a.slug.localeCompare(b.slug));
writeFileSync(join(dir, "developers.json"), JSON.stringify(sortBySlug(devs.values()), null, 2) + "\n");
writeFileSync(join(dir, "micro_markets.json"), JSON.stringify(sortBySlug(mms.values()), null, 2) + "\n");
console.log(`Merged ${files.length} research file(s): ${devs.size} developers, ${mms.size} micro-markets.`);
