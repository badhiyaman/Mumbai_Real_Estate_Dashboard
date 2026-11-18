"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProjectCard } from "@/lib/cards";
import { fmtCr, fmtPct, fmtPsf, STATUS_LABEL } from "@/lib/metrics";

type SortKey = "cagr" | "growth" | "launch" | "price" | "name";

const uniqueSorted = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort();

export default function ProjectGallery({ cards }: { cards: ProjectCard[] }) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [developer, setDeveloper] = useState("");
  const [status, setStatus] = useState("");
  const [config, setConfig] = useState("");
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [minTicket, setMinTicket] = useState("");
  const [minAcres, setMinAcres] = useState("");
  const [minCagr, setMinCagr] = useState("");
  const [sort, setSort] = useState<SortKey>("cagr");

  const areas = useMemo(() => uniqueSorted(cards.map((c) => c.area)), [cards]);
  const developers = useMemo(() => uniqueSorted(cards.map((c) => c.developer)), [cards]);
  const configs = useMemo(() => uniqueSorted(cards.flatMap((c) => c.configs)), [cards]);
  const years = useMemo(
    () => [...new Set(cards.map((c) => c.launchYear).filter((y): y is number => y != null))].sort(),
    [cards],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = cards.filter((c) => {
      if (q && !`${c.name} ${c.developer} ${c.area}`.toLowerCase().includes(q)) return false;
      if (area && c.area !== area) return false;
      if (developer && c.developer !== developer) return false;
      if (status && c.status !== status) return false;
      if (config && !c.configs.includes(config)) return false;
      if (fromYear && (c.launchYear == null || c.launchYear < +fromYear)) return false;
      if (toYear && (c.launchYear == null || c.launchYear > +toYear)) return false;
      if (minTicket && (c.minTicketCr == null || c.minTicketCr < +minTicket)) return false;
      if (minAcres && (c.landAcres == null || c.landAcres < +minAcres)) return false;
      if (minCagr && (c.cagr == null || c.cagr * 100 < +minCagr)) return false;
      return true;
    });
    const val = (c: ProjectCard): number | string => {
      switch (sort) {
        case "cagr": return c.cagr ?? -Infinity;
        case "growth": return c.totalGrowth ?? -Infinity;
        case "launch": return c.launchYear ?? -Infinity;
        case "price": return c.latestPsf ?? -Infinity;
        case "name": return c.name;
      }
    };
    return list.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb);
      return (vb as number) - (va as number);
    });
  }, [cards, query, area, developer, status, config, fromYear, toYear, minTicket, minAcres, minCagr, sort]);

  const reset = () => {
    setQuery(""); setArea(""); setDeveloper(""); setStatus(""); setConfig("");
    setFromYear(""); setToYear(""); setMinTicket(""); setMinAcres(""); setMinCagr("");
  };

  const field = "w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm";
  const label = "block space-y-1 text-xs text-muted";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3 lg:grid-cols-6">
        <label className={`${label} col-span-2 sm:col-span-3 lg:col-span-2`}>
          <span>Search</span>
          <input className={field} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Project, developer, area" />
        </label>
        <label className={label}>
          <span>Area</span>
          <select className={field} value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">All</option>
            {areas.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className={label}>
          <span>Developer</span>
          <select className={field} value={developer} onChange={(e) => setDeveloper(e.target.value)}>
            <option value="">All</option>
            {developers.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label className={label}>
          <span>Status</span>
          <select className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className={label}>
          <span>Apartment type</span>
          <select className={field} value={config} onChange={(e) => setConfig(e.target.value)}>
            <option value="">All</option>
            {configs.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className={label}>
          <span>Launched from</span>
          <select className={field} value={fromYear} onChange={(e) => setFromYear(e.target.value)}>
            <option value="">Any</option>
            {years.map((y) => <option key={y}>{y}</option>)}
          </select>
        </label>
        <label className={label}>
          <span>Launched to</span>
          <select className={field} value={toYear} onChange={(e) => setToYear(e.target.value)}>
            <option value="">Any</option>
            {years.map((y) => <option key={y}>{y}</option>)}
          </select>
        </label>
        <label className={label}>
          <span>Min ticket (₹ Cr)</span>
          <input className={field} type="number" min={0} value={minTicket} onChange={(e) => setMinTicket(e.target.value)} placeholder="e.g. 5" />
        </label>
        <label className={label}>
          <span>Min land (acres)</span>
          <input className={field} type="number" min={0} step="0.5" value={minAcres} onChange={(e) => setMinAcres(e.target.value)} />
        </label>
        <label className={label}>
          <span>Min yearly growth (%)</span>
          <input className={field} type="number" step="0.5" value={minCagr} onChange={(e) => setMinCagr(e.target.value)} />
        </label>
        <label className={label}>
          <span>Sort by</span>
          <select className={field} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="cagr">Yearly growth (CAGR)</option>
            <option value="growth">Total growth</option>
            <option value="launch">Newest launch</option>
            <option value="price">Price per sq ft</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between text-sm text-muted">
        <span>{shown.length} of {cards.length} projects</span>
        <button onClick={reset} className="hover:text-foreground">Clear filters</button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted">
          No projects match these filters.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => <Card key={c.slug} c={c} />)}
        </ul>
      )}
    </div>
  );
}

function Card({ c }: { c: ProjectCard }) {
  const initials = c.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
  return (
    <li>
      <Link
        href={`/projects/${c.slug}`}
        className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition hover:border-accent"
      >
        <div className="relative aspect-[16/9] bg-gradient-to-br from-accent/25 to-accent/5">
          {c.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-4xl font-semibold text-accent/60">{initials}</span>
          )}
          <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
            {STATUS_LABEL[c.status]}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div>
            <h3 className="font-medium leading-tight">{c.name}</h3>
            <p className="text-sm text-muted">
              {c.developer} · {c.area}
              {c.launchYear ? ` · ${c.launchYear}` : ""}
            </p>
          </div>
          <dl className="mt-auto grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted">Latest price</dt>
              <dd>{c.latestPsf ? fmtPsf(c.latestPsf) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">From</dt>
              <dd>{c.minTicketCr ? fmtCr(c.minTicketCr) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Total growth</dt>
              <dd className={growthColor(c.totalGrowth)}>
                {c.totalGrowth != null ? fmtPct(c.totalGrowth) : "—"}
                {c.growthYears ? <span className="text-xs text-muted"> / {c.growthYears.toFixed(0)} yrs</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Yearly (CAGR)</dt>
              <dd className={growthColor(c.cagr)}>{c.cagr != null ? fmtPct(c.cagr, 1) : "—"}</dd>
            </div>
          </dl>
        </div>
      </Link>
    </li>
  );
}

function growthColor(v: number | null) {
  if (v == null) return "";
  return v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
}
