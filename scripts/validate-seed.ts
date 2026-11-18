// Checks every file in data/seed/ for format mistakes before seeding.
// Run with: npm run validate

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SeedDeveloper, SeedMicroMarket, SeedProject } from "../src/lib/seed-types";

const dir = join(process.cwd(), "data", "seed");
const problems: string[] = [];
const warn: string[] = [];
const bad = (where: string, msg: string) => problems.push(`${where}: ${msg}`);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\/\S+$/;
const STAGES = ["pre_launch", "launch", "under_construction", "completion", "resale"];
const STATUSES = ["completed", "under_construction", "upcoming"];
const BASES = ["carpet", "saleable", "unknown"];
const CONF = ["high", "medium", "low"];
const PRECISION = ["day", "month", "year"];
const EVENTS = ["launch", "price_hike", "deal", "delay", "litigation", "possession", "rera", "redevelopment", "other"];

const read = <T>(p: string): T | null => {
  try {
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch (e) {
    bad(p, `invalid JSON (${(e as Error).message})`);
    return null;
  }
};

const devs = existsSync(join(dir, "developers.json")) ? read<SeedDeveloper[]>(join(dir, "developers.json")) ?? [] : [];
const mms = existsSync(join(dir, "micro_markets.json")) ? read<SeedMicroMarket[]>(join(dir, "micro_markets.json")) ?? [] : [];
const devSlugs = new Set(devs.map((d) => d.slug));
const mmSlugs = new Set(mms.map((m) => m.slug));
if (!devs.length) bad("developers.json", "missing or empty");
if (!mms.length) bad("micro_markets.json", "missing or empty");

const projDir = join(dir, "projects");
const files = existsSync(projDir) ? readdirSync(projDir).filter((f) => f.endsWith(".json")) : [];
const seenSlugs = new Set<string>();

for (const f of files) {
  const p = read<SeedProject>(join(projDir, f));
  if (!p) continue;
  const w = p.slug ?? f;
  if (`${p.slug}.json` !== f) bad(w, `file name should be ${p.slug}.json`);
  if (seenSlugs.has(p.slug)) bad(w, "duplicate slug");
  seenSlugs.add(p.slug);
  if (!p.name) bad(w, "missing name");
  if (!devSlugs.has(p.developer)) bad(w, `developer "${p.developer}" not in developers.json`);
  if (!mmSlugs.has(p.micro_market)) bad(w, `micro_market "${p.micro_market}" not in micro_markets.json`);
  if (!STATUSES.includes(p.status)) bad(w, `bad status "${p.status}"`);
  for (const k of ["launch_date", "possession_promised", "possession_actual"] as const)
    if (p[k] && !DATE.test(p[k]!)) bad(w, `${k} "${p[k]}" is not YYYY-MM-DD`);
  for (const k of ["rera_ids", "amenities", "sources", "unit_types", "price_points", "news"] as const)
    if (!Array.isArray(p[k])) bad(w, `${k} must be a list`);

  (p.price_points ?? []).forEach((pp, i) => {
    const at = `${w} price #${i + 1}`;
    if (!DATE.test(pp.date)) bad(at, `date "${pp.date}"`);
    if (!PRECISION.includes(pp.date_precision)) bad(at, `date_precision "${pp.date_precision}"`);
    if (!STAGES.includes(pp.stage)) bad(at, `stage "${pp.stage}"`);
    if (!BASES.includes(pp.basis)) bad(at, `basis "${pp.basis}"`);
    if (!CONF.includes(pp.confidence)) bad(at, `confidence "${pp.confidence}"`);
    if (typeof pp.price_psf !== "number" || pp.price_psf < 3000 || pp.price_psf > 400000)
      bad(at, `price_psf ${pp.price_psf} looks wrong (expected ₹3,000–4,00,000)`);
    if (!pp.source_url || !URL_RE.test(pp.source_url)) bad(at, "missing or invalid source_url");
  });
  (p.news ?? []).forEach((n, i) => {
    const at = `${w} news #${i + 1}`;
    if (!DATE.test(n.date)) bad(at, `date "${n.date}"`);
    if (!URL_RE.test(n.url ?? "")) bad(at, "invalid url");
    if (!EVENTS.includes(n.event_type)) bad(at, `event_type "${n.event_type}"`);
    if (!n.title) bad(at, "missing title");
  });
  (p.unit_types ?? []).forEach((u, i) => {
    if (!u.config) bad(`${w} unit #${i + 1}`, "missing config");
  });

  if ((p.price_points ?? []).length < 2) warn.push(`${w}: only ${(p.price_points ?? []).length} price point(s), growth can't be computed`);
  if (!(p.news ?? []).length) warn.push(`${w}: no news items`);
}

console.log(`Checked ${files.length} projects, ${devs.length} developers, ${mms.length} micro-markets.`);
if (warn.length) console.log(`\nWarnings:\n  ${warn.join("\n  ")}`);
if (problems.length) {
  console.log(`\nProblems (${problems.length}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("\nNo problems found.");
