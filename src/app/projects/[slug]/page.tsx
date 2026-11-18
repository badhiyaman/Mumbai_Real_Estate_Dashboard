import Link from "next/link";
import { notFound } from "next/navigation";
import PriceChart, { type ChartEvent, type ChartPoint } from "@/components/PriceChart";
import {
  fmtCr,
  fmtDate,
  fmtPct,
  fmtPsf,
  growth,
  sortedPrices,
  stageGrowth,
  STAGE_LABEL,
  STATUS_LABEL,
  type Growth,
} from "@/lib/metrics";
import { getProject, getProjectNews, getProjects } from "@/lib/queries";
import type { ProjectNewsItem } from "@/lib/types";

export const revalidate = 600;

// Benchmarks for "what if the money had gone elsewhere". Rough long-run averages.
const FD_RATE = 0.065; // typical 1-year bank FD rate in India, 2010s–2020s
const CPI_RATE = 0.055; // approximate average consumer inflation over the same period

const EVENT_LABEL: Record<string, string> = {
  launch: "Launch",
  price_hike: "Price change",
  deal: "Deal",
  delay: "Delay",
  litigation: "Legal",
  possession: "Possession",
  rera: "RERA",
  redevelopment: "Redevelopment",
  other: "News",
};

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  const [news, all] = await Promise.all([getProjectNews(project.id), getProjects()]);

  const prices = sortedPrices(project.price_points);
  const overall = growth(project.price_points);
  const buildPhase = stageGrowth(project.price_points, ["pre_launch", "launch"], ["completion"]);
  const afterCompletion = stageGrowth(project.price_points, ["completion"], ["resale"]);

  // Average yearly growth of other projects in the same area, for comparison.
  const peers = all
    .filter((p) => p.id !== project.id && p.micro_market?.slug === project.micro_market?.slug)
    .map((p) => growth(p.price_points)?.cagr)
    .filter((v): v is number => v != null);
  const peerAvg = peers.length ? peers.reduce((a, b) => a + b, 0) / peers.length : null;

  const chartPoints: ChartPoint[] = prices.map((p) => ({
    t: new Date(p.date).getTime(),
    [p.basis]: p.price_psf,
    label: `${STAGE_LABEL[p.stage]} · ${fmtDate(p.date, p.date_precision)}`,
    source: p.source_name ?? "",
  }));
  const chartEvents: ChartEvent[] = news
    .filter((n) => n.article.published_at)
    .map((n) => ({ t: new Date(n.article.published_at!).getTime(), title: n.article.title }));

  const facts: [string, string | null][] = [
    ["Developer", project.developer?.name ?? null],
    ["Area", [project.micro_market?.name, project.micro_market?.region].filter(Boolean).join(", ") || null],
    ["Status", STATUS_LABEL[project.status]],
    ["Launched", project.launch_date ? fmtDate(project.launch_date) : null],
    ["Possession promised", project.possession_promised ? fmtDate(project.possession_promised) : null],
    ["Possession actual", project.possession_actual ? fmtDate(project.possession_actual) : null],
    ["Land parcel", project.land_acres ? `${project.land_acres} acres` : null],
    ["Towers", project.towers ? String(project.towers) : null],
    ["Tallest tower", project.floors_max ? `${project.floors_max} floors` : null],
    ["Total units", project.total_units ? project.total_units.toLocaleString("en-IN") : null],
    ["MahaRERA", project.rera_ids.length ? project.rera_ids.join(", ") : null],
  ];

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <Link href="/history" className="text-sm text-muted hover:text-foreground">← Market History</Link>
        <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
        {project.address && <p className="text-muted">{project.address}</p>}
        {project.description && <p className="max-w-3xl">{project.description}</p>}
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Overall growth" g={overall} />
        <Stat label="Launch → completion" g={buildPhase} />
        <Stat label="Completion → today" g={afterCompletion} />
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs text-muted">Compared with</div>
          <ul className="mt-1 space-y-0.5 text-sm">
            <li>Area average: {peerAvg != null ? `${fmtPct(peerAvg, 1)}/yr` : "not enough data"}</li>
            <li>Bank FD: {(FD_RATE * 100).toFixed(1)}%/yr</li>
            <li>Inflation: ~{(CPI_RATE * 100).toFixed(1)}%/yr</li>
          </ul>
        </div>
      </section>

      <Section title="Price history">
        <PriceChart points={chartPoints} events={chartEvents} />
        {prices.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-normal">Date</th>
                  <th className="py-2 pr-3 font-normal">Stage</th>
                  <th className="py-2 pr-3 font-normal">Price</th>
                  <th className="py-2 pr-3 font-normal">Basis</th>
                  <th className="py-2 pr-3 font-normal">Confidence</th>
                  <th className="py-2 font-normal">Source</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p) => (
                  <tr key={p.id} className="border-b border-border align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(p.date, p.date_precision)}</td>
                    <td className="py-2 pr-3">{STAGE_LABEL[p.stage]}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtPsf(p.price_psf)}</td>
                    <td className="py-2 pr-3 capitalize">{p.basis}</td>
                    <td className="py-2 pr-3"><ConfidenceBadge c={p.confidence} /></td>
                    <td className="py-2">
                      {p.source_url ? (
                        <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                          {p.source_name ?? "Source"}
                        </a>
                      ) : (p.source_name ?? "—")}
                      {p.note && <div className="text-xs text-muted">{p.note}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          Prices come from news reports, registered deals and listings, and are approximate. Carpet and saleable
          prices aren&apos;t directly comparable: saleable area is usually 25–40% larger, so its per-sq-ft price looks lower.
        </p>
      </Section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Key facts">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {facts.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Apartment types">
          {project.unit_types.length === 0 ? (
            <p className="text-sm text-muted">No unit details yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-normal">Type</th>
                  <th className="py-2 pr-3 font-normal">Carpet area</th>
                  <th className="py-2 font-normal">Ticket size</th>
                </tr>
              </thead>
              <tbody>
                {project.unit_types.map((u) => (
                  <tr key={u.id} className="border-b border-border align-top">
                    <td className="py-2 pr-3">{u.config}</td>
                    <td className="py-2 pr-3">{range(u.carpet_sqft_min, u.carpet_sqft_max, (n) => `${n.toLocaleString("en-IN")} sq ft`)}</td>
                    <td className="py-2">
                      {range(u.price_min_cr, u.price_max_cr, fmtCr)}
                      {u.notes && <div className="text-xs text-muted">{u.notes}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      <Section title={`News about ${project.name}`}>
        <NewsTimeline items={news} />
      </Section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Amenities">
          {project.amenities.length ? (
            <ul className="flex flex-wrap gap-2 text-sm">
              {project.amenities.map((a) => (
                <li key={a} className="rounded-full border border-border px-3 py-1">{a}</li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Not listed.</p>}
        </Section>

        <Section title={`Around ${project.micro_market?.name ?? "the area"}`}>
          {project.micro_market?.catalysts?.length ? (
            <ul className="space-y-2 text-sm">
              {project.micro_market.catalysts.map((c) => (
                <li key={c.name}>
                  <span className="font-medium">{c.name}</span>{" "}
                  <span className="text-muted">
                    · {c.status.replace("_", " ")}{c.expected_year ? ` (${c.expected_year})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No infrastructure projects recorded yet.</p>}
          {project.micro_market?.notes && <p className="mt-3 text-sm text-muted">{project.micro_market.notes}</p>}
        </Section>
      </div>

      {project.developer && (
        <Section title={`About ${project.developer.name}`}>
          <div className="space-y-2 text-sm">
            {project.developer.delivery_track_record && <p>{project.developer.delivery_track_record}</p>}
            {project.developer.notes && <p className="text-muted">{project.developer.notes}</p>}
          </div>
        </Section>
      )}

      {project.notes && (
        <Section title="Things to know">
          <p className="whitespace-pre-line text-sm">{project.notes}</p>
        </Section>
      )}

      {project.lat != null && project.lng != null && (
        <Section title="Location">
          <iframe
            title="Map"
            className="h-72 w-full rounded-lg border border-border"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${project.lng - 0.01}%2C${project.lat - 0.007}%2C${project.lng + 0.01}%2C${project.lat + 0.007}&layer=mapnik&marker=${project.lat}%2C${project.lng}`}
          />
        </Section>
      )}

      {project.sources.length > 0 && (
        <Section title="Sources">
          <ul className="space-y-1 text-sm">
            {project.sources.map((s) => (
              <li key={s} className="truncate">
                <a href={s} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{s}</a>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, g }: { label: string; g: Growth | null }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      {g ? (
        <>
          <div className="mt-1 text-xl font-semibold">{g.cagr != null ? `${fmtPct(g.cagr, 1)}/yr` : fmtPct(g.totalPct)}</div>
          <div className="text-xs text-muted">
            {fmtPct(g.totalPct)} over {g.years.toFixed(1)} yrs · {fmtPsf(g.first.price_psf)} → {fmtPsf(g.last.price_psf)}
          </div>
        </>
      ) : (
        <div className="mt-1 text-sm text-muted">Not enough data</div>
      )}
    </div>
  );
}

function ConfidenceBadge({ c }: { c: "high" | "medium" | "low" }) {
  const cls = {
    high: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    low: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
  }[c];
  return <span className={`rounded px-1.5 py-0.5 text-xs capitalize ${cls}`}>{c}</span>;
}

function NewsTimeline({ items }: { items: ProjectNewsItem[] }) {
  if (!items.length) return <p className="text-sm text-muted">No news linked to this project yet.</p>;
  return (
    <ol className="space-y-4 border-l border-border pl-4">
      {items.map((n) => (
        <li key={n.article.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{n.article.published_at ? fmtDate(n.article.published_at, "day") : "Undated"}</span>
            {n.event_type && <span className="rounded border border-border px-1.5">{EVENT_LABEL[n.event_type] ?? n.event_type}</span>}
            {n.article.source && <span>{n.article.source}</span>}
          </div>
          <a href={n.article.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-accent">
            {n.article.title}
          </a>
          {n.article.snippet && <p className="text-sm text-muted">{n.article.snippet}</p>}
        </li>
      ))}
    </ol>
  );
}

function range<T extends number>(min: T | null, max: T | null, f: (n: T) => string): string {
  if (min != null && max != null && min !== max) return `${f(min)} – ${f(max)}`;
  if (min != null) return f(min);
  if (max != null) return f(max);
  return "—";
}
