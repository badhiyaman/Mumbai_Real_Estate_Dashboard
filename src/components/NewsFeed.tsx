"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { NewsArticle } from "@/lib/queries";
import { headlineWords, sameStory, TOPICS } from "@/lib/news/rules";

type Period = "7" | "30" | "90" | "all";

interface Story {
  lead: NewsArticle;
  others: NewsArticle[]; // the same story from other outlets
}

const DAY = 24 * 3600 * 1000;

function dayLabel(iso: string | null, now: number): string {
  if (!iso) return "Undated";
  const d = new Date(iso);
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / DAY);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: days < 7 ? "long" : undefined, day: "numeric", month: "short", year: "numeric" });
}

/** Groups repeats of the same story (published within 3 days of each other) under the first one seen. */
function groupStories(articles: NewsArticle[]): Story[] {
  const stories: (Story & { words: Set<string>; t: number })[] = [];
  for (const a of articles) {
    const words = headlineWords(a.title);
    const t = a.published_at ? Date.parse(a.published_at) : 0;
    const match = stories.find((s) => Math.abs(s.t - t) <= 3 * DAY && sameStory(s.words, words));
    if (match) match.others.push(a);
    else stories.push({ lead: a, others: [], words, t });
  }
  return stories;
}

export default function NewsFeed({
  articles,
  names,
  now,
}: {
  articles: NewsArticle[];
  names: { areas: Record<string, string>; developers: Record<string, string> };
  now: number; // server time, so "Today" matches on server and client
}) {
  const [period, setPeriod] = useState<Period>("30");
  const [topic, setTopic] = useState("");
  const [area, setArea] = useState("");
  const [developer, setDeveloper] = useState("");
  const [query, setQuery] = useState("");
  const [projectsOnly, setProjectsOnly] = useState(false);

  const used = useMemo(() => {
    const areas = new Set<string>(), devs = new Set<string>();
    for (const a of articles) {
      a.micro_market_slugs.forEach((s) => areas.add(s));
      a.developer_slugs.forEach((s) => devs.add(s));
    }
    const sortByName = (xs: Set<string>, n: Record<string, string>) => [...xs].filter((s) => n[s]).sort((x, y) => n[x].localeCompare(n[y]));
    return { areas: sortByName(areas, names.areas), devs: sortByName(devs, names.developers) };
  }, [articles, names]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cutoff = period === "all" ? -Infinity : now - +period * DAY;
    const filtered = articles.filter((a) => {
      const t = a.published_at ? Date.parse(a.published_at) : Date.parse(a.created_at);
      if (t < cutoff) return false;
      if (topic && !a.topics.includes(topic)) return false;
      if (area && !a.micro_market_slugs.includes(area)) return false;
      if (developer && !a.developer_slugs.includes(developer)) return false;
      if (projectsOnly && !a.projects.length) return false;
      if (q && !`${a.title} ${a.snippet ?? ""} ${a.source ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const stories = groupStories(filtered);
    const byDay: { label: string; stories: Story[] }[] = [];
    for (const s of stories) {
      const label = dayLabel(s.lead.published_at, now);
      const last = byDay[byDay.length - 1];
      if (last?.label === label) last.stories.push(s);
      else byDay.push({ label, stories: [s] });
    }
    return { byDay, stories: stories.length, articles: filtered.length };
  }, [articles, period, topic, area, developer, query, projectsOnly, now]);

  const field = "w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm";
  const label = "block space-y-1 text-xs text-muted";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3 lg:grid-cols-6">
        <label className={`${label} col-span-2 sm:col-span-3 lg:col-span-2`}>
          <span>Search</span>
          <input className={field} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Headline, outlet…" />
        </label>
        <label className={label}>
          <span>Period</span>
          <select className={field} value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time (incl. project history)</option>
          </select>
        </label>
        <label className={label}>
          <span>Topic</span>
          <select className={field} value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">All</option>
            {Object.entries(TOPICS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label className={label}>
          <span>Area</span>
          <select className={field} value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">All</option>
            {used.areas.map((s) => <option key={s} value={s}>{names.areas[s]}</option>)}
          </select>
        </label>
        <label className={label}>
          <span>Developer</span>
          <select className={field} value={developer} onChange={(e) => setDeveloper(e.target.value)}>
            <option value="">All</option>
            {used.devs.map((s) => <option key={s} value={s}>{names.developers[s]}</option>)}
          </select>
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-3 lg:col-span-6">
          <input type="checkbox" checked={projectsOnly} onChange={(e) => setProjectsOnly(e.target.checked)} />
          Only stories about projects in this dashboard
        </label>
      </div>

      <p className="text-sm text-muted">
        {groups.stories} stor{groups.stories === 1 ? "y" : "ies"}
        {groups.articles > groups.stories ? ` (${groups.articles} articles; repeats from other outlets are grouped)` : ""}
      </p>

      {groups.byDay.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted">
          No stories match. Try a longer period or clear the filters.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.byDay.map((day) => (
            <section key={day.label} className="space-y-3">
              <h2 className="sticky top-0 z-10 bg-background/95 py-1 text-sm font-medium text-muted backdrop-blur">{day.label}</h2>
              <ul className="space-y-3">
                {day.stories.map((s) => <StoryCard key={s.lead.id} story={s} names={names} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function StoryCard({ story, names }: { story: Story; names: { areas: Record<string, string>; developers: Record<string, string> } }) {
  const a = story.lead;
  const all = [a, ...story.others];
  const projects = [...new Map(all.flatMap((x) => x.projects).map((p) => [p.slug, p])).values()];
  const topics = [...new Set(all.flatMap((x) => x.topics))];
  const areas = [...new Set(all.flatMap((x) => x.micro_market_slugs))].filter((s) => names.areas[s]);
  const devs = [...new Set(all.flatMap((x) => x.developer_slugs))].filter((s) => names.developers[s]);
  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span>{a.source ?? "Unknown source"}</span>
        {a.fromResearch && <span className="rounded border border-border px-1.5">Project history</span>}
        {topics.map((t) => (
          <span key={t} className="rounded bg-accent/10 px-1.5 text-accent">{TOPICS[t]?.label ?? t}</span>
        ))}
      </div>
      <a href={a.url} target="_blank" rel="noopener noreferrer" className="mt-1 block font-medium hover:text-accent">
        {a.title}
      </a>
      {a.snippet && <p className="mt-1 line-clamp-2 text-sm text-muted">{a.snippet}</p>}
      {(projects.length > 0 || areas.length > 0 || devs.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {projects.map((p) => (
            <Link key={p.slug} href={`/projects/${p.slug}`} className="rounded-full border border-accent/50 px-2 py-0.5 text-accent hover:bg-accent/10">
              {p.name}
            </Link>
          ))}
          {areas.map((s) => <span key={s} className="rounded-full border border-border px-2 py-0.5 text-muted">{names.areas[s]}</span>)}
          {devs.map((s) => <span key={s} className="rounded-full border border-border px-2 py-0.5 text-muted">{names.developers[s]}</span>)}
        </div>
      )}
      {story.others.length > 0 && (
        <details className="mt-2 text-xs text-muted">
          <summary className="cursor-pointer">Also covered by {story.others.length} other outlet{story.others.length === 1 ? "" : "s"}</summary>
          <ul className="mt-1 space-y-1 pl-4">
            {story.others.map((o) => (
              <li key={o.id}>
                <a href={o.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                  {o.source}: {o.title}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}
