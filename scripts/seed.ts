// Loads the JSON files in data/seed/ into Supabase.
// Run with: npm run seed
// Safe to re-run: rows are matched by slug (or URL for news) and updated.
// Note: re-running replaces each seeded project's unit types and price points with the JSON version.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { SeedDeveloper, SeedMicroMarket, SeedProject } from "../src/lib/seed-types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const seedDir = join(process.cwd(), "data", "seed");
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return (res.data ?? []) as T;
}

async function main() {
  const developers = readJson<SeedDeveloper[]>(join(seedDir, "developers.json"));
  const markets = readJson<SeedMicroMarket[]>(join(seedDir, "micro_markets.json"));
  const projectDir = join(seedDir, "projects");
  const projects = existsSync(projectDir)
    ? readdirSync(projectDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => readJson<SeedProject>(join(projectDir, f)))
    : [];

  const devRows = check(
    await db.from("developers").upsert(developers, { onConflict: "slug" }).select("id, slug"),
    "developers",
  );
  const devId = new Map(devRows.map((r) => [r.slug, r.id]));

  const mmRows = check(
    await db.from("micro_markets").upsert(markets, { onConflict: "slug" }).select("id, slug"),
    "micro_markets",
  );
  const mmId = new Map(mmRows.map((r) => [r.slug, r.id]));

  for (const p of projects) {
    const { unit_types, price_points, news, developer, micro_market, ...fields } = p;
    if (!devId.has(developer)) throw new Error(`${p.slug}: unknown developer "${developer}"`);
    if (!mmId.has(micro_market)) throw new Error(`${p.slug}: unknown micro-market "${micro_market}"`);

    const [row] = check(
      await db
        .from("projects")
        .upsert(
          {
            ...fields,
            developer_id: devId.get(developer),
            micro_market_id: mmId.get(micro_market),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "slug" },
        )
        .select("id"),
      `project ${p.slug}`,
    );
    const projectId = row.id;

    check(await db.from("unit_types").delete().eq("project_id", projectId), "clear unit_types");
    if (unit_types.length)
      check(
        await db.from("unit_types").insert(unit_types.map((u) => ({ ...u, project_id: projectId }))),
        `unit_types ${p.slug}`,
      );

    check(await db.from("price_points").delete().eq("project_id", projectId), "clear price_points");
    if (price_points.length)
      check(
        await db.from("price_points").insert(price_points.map((pp) => ({ ...pp, project_id: projectId }))),
        `price_points ${p.slug}`,
      );

    if (news.length) {
      const articles = check(
        await db
          .from("news_articles")
          .upsert(
            news.map((n) => ({
              url: n.url,
              title: n.title,
              source: n.source,
              published_at: n.date,
              snippet: n.summary ?? null,
              developer_slugs: [developer],
              micro_market_slugs: [micro_market],
            })),
            { onConflict: "url" },
          )
          .select("id, url"),
        `news ${p.slug}`,
      );
      const articleId = new Map(articles.map((a) => [a.url, a.id]));
      check(
        await db.from("project_news").upsert(
          news.map((n) => ({
            project_id: projectId,
            article_id: articleId.get(n.url),
            event_type: n.event_type,
            origin: "research",
          })),
          { onConflict: "project_id,article_id" },
        ),
        `project_news ${p.slug}`,
      );
    }
    console.log(`✓ ${p.name}: ${price_points.length} prices, ${news.length} news`);
  }

  console.log(`Done: ${developers.length} developers, ${markets.length} micro-markets, ${projects.length} projects.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
