// Runs the daily news job once, locally.
//   npm run news                 fetch and save stories from the last 10 days
//   npm run news -- 30           look back 30 days instead
//   npm run news -- --dry-run    show what would be saved, without saving
//   npm run news -- --recheck    remove saved stories that fail the current filter (add --dry-run to preview)
import { createClient } from "@supabase/supabase-js";
import { ingestNews, recheckStored } from "../src/lib/news/ingest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const recheck = args.includes("--recheck");
const unknown = args.filter((a) => a !== "--dry-run" && a !== "--recheck" && !/^\d+$/.test(a));
if (unknown.length) {
  console.error(`Unknown option(s): ${unknown.join(" ")}. Use a number of days and/or --dry-run.`);
  process.exit(1);
}
const days = Number(args.find((a) => /^\d+$/.test(a)) ?? 10);

const db = createClient(url, key, { auth: { persistSession: false } });
const fail = (e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
};

if (recheck) {
  recheckStored(db, { dryRun })
    .then((r) => {
      for (const x of r.removed) console.log(`  - ${x.title}`);
      console.log(`\n${dryRun ? "DRY RUN: would remove" : "Removed"} ${r.removed.length} of ${r.checked} auto-collected stories.`);
    })
    .catch(fail);
} else {
  ingestNews(db, { maxAgeDays: days, dryRun })
  .then((r) => {
    for (const f of r.feeds) console.log(`${f.ok ? "✓" : "✗"} ${f.name}: ${f.ok ? `${f.items} items` : f.error}`);
    if (r.sample) for (const s of r.sample) console.log(`  • ${s.title} [${s.source}] {${s.topics.join(",")}} ${s.tags.join(" ")}`);
    console.log(
      `\n${dryRun ? "DRY RUN, nothing saved. " : ""}Fetched ${r.fetched}, relevant ${r.relevant} (last ${r.maxAgeDays} days), ` +
        `duplicates ${r.duplicates}, ${dryRun ? "would save" : "saved"} ${dryRun ? r.sample?.length ?? 0 : r.saved}, ` +
        `linked to projects ${r.linkedToProjects}.`,
    );
  })
  .catch(fail);
}
