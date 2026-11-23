// The daily news job: fetch RSS feeds, keep Mumbai real estate stories, tag them, save new ones.
// Used by the /api/cron/news route (daily on Vercel) and by `npm run news` (locally).

import { XMLParser } from "fast-xml-parser";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  developerAliases,
  FEEDS,
  isRelevant,
  matchNames,
  projectAliases,
  stripHtml,
  titleKey,
  topicsFor,
  type NameIndex,
} from "./rules";

interface FeedItem {
  general: boolean;
  title: string;
  url: string;
  source: string;
  published_at: string | null;
  snippet: string;
}

export interface IngestReport {
  feeds: { name: string; ok: boolean; items: number; error?: string }[];
  fetched: number;
  relevant: number;
  duplicates: number;
  saved: number;
  linkedToProjects: number;
  maxAgeDays: number;
  sample?: { title: string; source: string; topics: string[]; tags: string[] }[]; // dry runs only
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });
const text = (v: unknown): string =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : v && typeof v === "object" && "#text" in v ? String((v as Record<string, unknown>)["#text"]) : "";

async function fetchFeed(feed: { name: string; url: string; general?: boolean }): Promise<FeedItem[]> {
  const res = await fetch(feed.url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RealEstateDashboard/1.0; RSS reader)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  const doc = parser.parse(xml);
  const rawItems = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  const isGoogle = feed.url.includes("news.google.com");
  return items
    .map((it: Record<string, unknown>): FeedItem | null => {
      let title = stripHtml(text(it.title));
      const link = text(it.link) || (it.link as Record<string, string> | undefined)?.["@_href"] || "";
      if (!title || !link) return null;
      let source = text(it.source) || feed.name;
      if (isGoogle) {
        // Google News titles end with " - Outlet name"
        const m = title.match(/^(.*)\s+-\s+([^-]+)$/);
        if (m) {
          title = m[1].trim();
          source = text(it.source) || m[2].trim();
        }
      }
      const date = text(it.pubDate) || text(it.published) || text(it.updated);
      const parsed = date ? new Date(date) : null;
      const snippet = isGoogle ? "" : stripHtml(text(it.description) || text(it.summary)).slice(0, 400);
      return {
        general: !!feed.general,
        title,
        url: link.trim(),
        source,
        published_at: parsed && !isNaN(parsed.getTime()) ? parsed.toISOString() : null,
        snippet,
      };
    })
    .filter((x: FeedItem | null): x is FeedItem => x !== null);
}

/** Runs the whole job. `db` must be a server client with write access. */
export async function ingestNews(db: SupabaseClient, { maxAgeDays = 10, dryRun = false } = {}): Promise<IngestReport> {
  const report: IngestReport = { feeds: [], fetched: 0, relevant: 0, duplicates: 0, saved: 0, linkedToProjects: 0, maxAgeDays };

  // Names to tag stories with.
  const [{ data: projects, error: pe }, { data: devs, error: de }, { data: areas, error: ae }] = await Promise.all([
    db.from("projects").select("id, slug, name, developer:developers(name)"),
    db.from("developers").select("slug, name"),
    db.from("micro_markets").select("slug, name"),
  ]);
  if (pe || de || ae) throw new Error((pe ?? de ?? ae)!.message);

  const areaIndex: NameIndex[] = (areas ?? []).map((a) => ({
    slug: a.slug,
    names: a.name.split(/\s*[/(),]\s*/).map((n: string) => n.toLowerCase().trim()).filter(Boolean),
  }));
  const devIndex: NameIndex[] = (devs ?? []).map((d) => ({ slug: d.slug, names: developerAliases(d.name) }));
  const projIndex: (NameIndex & { id: number })[] = (projects ?? []).map((p) => ({
    id: p.id as number,
    slug: p.slug as string,
    names: projectAliases(p.name as string, (p.developer as unknown as { name: string } | null)?.name),
  }));
  const placeWords = areaIndex.flatMap((a) => a.names);

  // Fetch every feed; one failing feed never stops the rest.
  const all: FeedItem[] = [];
  await Promise.all(
    FEEDS.map(async (f) => {
      try {
        const items = await fetchFeed(f);
        report.feeds.push({ name: f.name, ok: true, items: items.length });
        all.push(...items);
      } catch (e) {
        report.feeds.push({ name: f.name, ok: false, items: 0, error: (e as Error).message });
      }
    }),
  );
  report.fetched = all.length;

  // Keep recent, relevant stories; drop repeats (same URL or same headline from another outlet).
  const cutoff = Date.now() - maxAgeDays * 24 * 3600 * 1000;
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: recent, error: re } = await db.from("news_articles").select("url, title").gte("created_at", since);
  if (re) throw new Error(re.message);
  const seenUrls = new Set((recent ?? []).map((r) => r.url));
  const seenTitles = new Set((recent ?? []).map((r) => titleKey(r.title)));

  const fresh: (FeedItem & { topics: string[]; areas: string[]; developers: string[]; projectIds: number[] })[] = [];
  for (const it of all) {
    if (it.published_at && Date.parse(it.published_at) < cutoff) continue;
    if (!isRelevant(it.title, it.snippet, placeWords, { general: it.general })) continue;
    report.relevant++;
    const key = titleKey(it.title);
    if (seenUrls.has(it.url) || seenTitles.has(key)) {
      report.duplicates++;
      continue;
    }
    seenUrls.add(it.url);
    seenTitles.add(key);
    const projSlugs = new Set(matchNames(it.title, it.snippet, projIndex));
    fresh.push({
      ...it,
      topics: topicsFor(it.title, it.snippet),
      areas: matchNames(it.title, it.snippet, areaIndex),
      developers: matchNames(it.title, it.snippet, devIndex),
      projectIds: projIndex.filter((p) => projSlugs.has(p.slug)).map((p) => p.id),
    });
  }

  if (dryRun) {
    report.sample = fresh.map((f) => ({
      title: f.title,
      source: f.source,
      topics: f.topics,
      tags: [...f.areas, ...f.developers, ...projIndex.filter((p) => f.projectIds.includes(p.id)).map((p) => "project:" + p.slug)],
    }));
    report.feeds.sort((a, b) => a.name.localeCompare(b.name));
    return report;
  }

  if (fresh.length) {
    const { data: saved, error } = await db
      .from("news_articles")
      .upsert(
        fresh.map((f) => ({
          url: f.url,
          title: f.title,
          source: f.source,
          published_at: f.published_at,
          snippet: f.snippet || null,
          topics: f.topics,
          micro_market_slugs: f.areas,
          developer_slugs: f.developers,
        })),
        { onConflict: "url", ignoreDuplicates: true },
      )
      .select("id, url");
    if (error) throw new Error(error.message);
    report.saved = saved?.length ?? 0;

    const idByUrl = new Map((saved ?? []).map((s) => [s.url, s.id]));
    const links = fresh.flatMap((f) =>
      idByUrl.has(f.url) ? f.projectIds.map((pid) => ({ project_id: pid, article_id: idByUrl.get(f.url), event_type: guessEvent(f.topics), origin: "auto" })) : [],
    );
    if (links.length) {
      const { error: le } = await db.from("project_news").upsert(links, { onConflict: "project_id,article_id", ignoreDuplicates: true });
      if (le) throw new Error(le.message);
      report.linkedToProjects = links.length;
    }
  }
  report.feeds.sort((a, b) => a.name.localeCompare(b.name));
  return report;
}

/**
 * Re-applies the current relevance filter to stories the job saved earlier and deletes the ones that
 * no longer pass. Stories found during research (linked with origin "research") are never touched.
 */
export async function recheckStored(
  db: SupabaseClient,
  { dryRun = false } = {},
): Promise<{ checked: number; removed: { id: number; title: string }[] }> {
  const { data: areas, error: ae } = await db.from("micro_markets").select("name");
  if (ae) throw new Error(ae.message);
  const placeWords = (areas ?? []).flatMap((a) =>
    (a.name as string).split(/\s*[/(),]\s*/).map((n) => n.toLowerCase().trim()).filter(Boolean),
  );
  const { data: research, error: re } = await db.from("project_news").select("article_id").eq("origin", "research");
  if (re) throw new Error(re.message);
  const keep = new Set((research ?? []).map((r) => r.article_id as number));
  const { data: rows, error } = await db.from("news_articles").select("id, title, snippet, source");
  if (error) throw new Error(error.message);
  const generalSources = new Set(FEEDS.filter((f) => f.general).map((f) => f.name));
  const candidates = (rows ?? []).filter((r) => !keep.has(r.id as number));
  const removed = candidates
    .filter((r) => !isRelevant(r.title, r.snippet ?? "", placeWords, { general: generalSources.has(r.source ?? "") }))
    .map((r) => ({ id: r.id as number, title: r.title as string }));
  if (!dryRun && removed.length) {
    const { error: de } = await db.from("news_articles").delete().in("id", removed.map((r) => r.id));
    if (de) throw new Error(de.message);
  }
  return { checked: candidates.length, removed };
}

function guessEvent(topics: string[]): string {
  if (topics.includes("deal")) return "deal";
  if (topics.includes("launch")) return "launch";
  if (topics.includes("legal")) return "litigation";
  if (topics.includes("redevelopment")) return "redevelopment";
  return "other";
}
