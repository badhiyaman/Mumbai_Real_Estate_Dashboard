import Link from "next/link";
import { notFound } from "next/navigation";
import PriceChart, { type ChartEvent, type ChartPoint } from "@/components/PriceChart";
import {
  fmtCr,
  fmtDate,
  fmtPct,
  fmtPsf,
  possessionLabel,
  growth,
  typicalYield,
  IMPLAUSIBLE_YIELD,
  rentalYields,
  sortedPrices,
  unitsPerAcre,
  stageGrowth,
  STAGE_LABEL,
  STATUS_LABEL,
  type Growth,
  type RentYield,
} from "@/lib/metrics";
import { getCostItems, getProject, getProjectNews, getProjects } from "@/lib/queries";
import { baseCagrFor, buildContext, combine, DEFAULT_WEIGHTS, scoreFactors } from "@/lib/scoring";
import { Disclaimer, FactorList, OutlookTable, ScoreBadge } from "@/components/ScoreBreakdown";
import type { CostItem, Project, ProjectNewsItem } from "@/lib/types";
import type { LandType } from "@/lib/seed-types";

const LAND_LABEL: Record<LandType, string> = {
  private: "Private land",
  mill_land: "Former mill land",
  redevelopment: "Redevelopment of an older building",
  sra: "Slum rehabilitation (SRA) scheme",
  government_lease: "Government / collector lease",
  other: "Other",
};
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const FURNISH_LABEL = { furnished: "Furnished", semi_furnished: "Semi-furnished", unfurnished: "Unfurnished", unknown: "" };

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
  const [news, all, costs] = await Promise.all([getProjectNews(project.id), getProjects(), getCostItems()]);

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

  // Investment score with the default weights (adjustable on the Opportunities page).
  const scoreCtx = buildContext(all);
  const factors = scoreFactors(project, scoreCtx);
  const base = baseCagrFor(project, scoreCtx);
  const scoreResult = combine(factors, DEFAULT_WEIGHTS, base.value);

  const chartPoints: ChartPoint[] = prices.map((p) => ({
    t: new Date(p.date).getTime(),
    [p.basis]: p.price_psf,
    label: `${STAGE_LABEL[p.stage]} · ${fmtDate(p.date, p.date_precision)}`,
    source: p.source_name ?? "",
  }));
  const chartEvents: ChartEvent[] = news
    .filter((n) => n.article.published_at)
    .map((n) => ({ t: new Date(n.article.published_at!).getTime(), title: n.article.title }));

  const p = project;
  const density = unitsPerAcre(p);
  const yields = rentalYields(p);
  const medianYield = typicalYield(yields);
  const areaYield = p.micro_market?.typical_rent_yield_pct;
  const n = (v: number | null | undefined, f: (x: number) => string = String) => (v == null ? null : f(v));
  const yes = (v: boolean | null) => (v == null ? null : v ? "Yes" : "No");

  const factGroups: { title: string; facts: [string, string | null][] }[] = [
    {
      title: "Project",
      facts: [
        ["Developer", p.developer?.name ?? null],
        ["Area", [p.micro_market?.name, p.micro_market?.region].filter(Boolean).join(", ") || null],
        ["Status", STATUS_LABEL[p.status]],
        ["Launched", p.launch_date ? fmtDate(p.launch_date) : null],
        ["Possession promised", p.possession_promised ? fmtDate(p.possession_promised) : null],
        ["Possession actual", p.possession_actual ? fmtDate(p.possession_actual) : null],
        ["Possession status", possessionLabel(p)],
        ["Branded residence", p.branded_residence],
      ],
    },
    {
      title: "Building & specs",
      facts: [
        ["Land parcel", n(p.land_acres, (x) => `${x} acres`)],
        ["Towers", n(p.towers)],
        ["Tallest tower", n(p.floors_max, (x) => `${x} floors`)],
        ["Total units", n(p.total_units, (x) => x.toLocaleString("en-IN"))],
        ["Density", n(density, (x) => `${Math.round(x)} units per acre`)],
        ["Flats per floor", n(p.flats_per_floor)],
        ["Lifts per tower", n(p.lifts_per_tower)],
        ["Ceiling height", n(p.ceiling_height_ft, (x) => `${x} ft`)],
        ["Car parks per unit", n(p.car_parks_per_unit)],
        ["Clubhouse", n(p.clubhouse_sqft, (x) => `${x.toLocaleString("en-IN")} sq ft`)],
        ["Open space", n(p.open_space_pct, (x) => `${x}% of land`)],
        ["Views", p.views?.length ? p.views.join(", ") : null],
        ["Architect", p.architect],
        ["Contractor", p.contractor],
        ["Green certification", p.green_certification],
      ],
    },
    {
      title: "Land & approvals",
      facts: [
        ["Land type", p.land_type ? LAND_LABEL[p.land_type] : null],
        ["Tenure", p.land_tenure && p.land_tenure !== "unknown" ? cap(p.land_tenure) : null],
        ["JV / landowner", p.jv_partner],
        ["Occupation certificate", p.oc_received == null ? null : `${yes(p.oc_received)}${p.oc_date ? ` (${fmtDate(p.oc_date)})` : ""}`],
        ["MahaRERA", p.rera_ids.length ? p.rera_ids.join(", ") : null],
        ["MahaRERA complaints", n(p.rera_complaints)],
        [
          "Units sold",
          p.units_sold == null
            ? null
            : `${p.units_sold.toLocaleString("en-IN")}${p.total_units ? ` of ${p.total_units.toLocaleString("en-IN")} (${Math.round((p.units_sold / p.total_units) * 100)}%)` : ""}${p.units_sold_as_of ? `, as of ${fmtDate(p.units_sold_as_of)}` : ""}`,
        ],
      ],
    },
    {
      title: "Pricing details",
      facts: [
        ["Loading", n(p.loading_pct, (x) => `${x}% (saleable area is ${x}% larger than carpet)`)],
        ["Floor rise", n(p.floor_rise_psf, (x) => `₹${x.toLocaleString("en-IN")}/sq ft per floor`)],
        ["Floor rise / view notes", p.floor_rise_notes],
        ["Maintenance", n(p.maintenance_psf_month, (x) => `₹${x}/sq ft per month`)],
        ["Payment plan", p.payment_plan],
        ["Registered sales, last 12 months", n(p.transactions_12m)],
      ],
    },
    {
      title: "Location",
      facts: [
        ["Nearest metro", p.nearest_metro ? `${p.nearest_metro}${p.nearest_metro_km != null ? ` (${p.nearest_metro_km} km)` : ""}` : null],
        ["To BKC", n(p.distance_bkc_km, (x) => `${x} km`)],
        ["To airport (T2)", n(p.distance_airport_km, (x) => `${x} km`)],
      ],
    },
  ];

  // Floor-rise illustration on a typical unit: how much more a high floor costs than a low one.
  const typicalCarpet = p.unit_types.find((u) => u.carpet_sqft_min)?.carpet_sqft_min ?? null;
  const floorRiseExample =
    p.floor_rise_psf && p.floors_max && typicalCarpet
      ? { floors: p.floors_max - 1, carpet: typicalCarpet, extraCr: (p.floor_rise_psf * (p.floors_max - 1) * typicalCarpet) / 1e7 }
      : null;

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <div className="flex gap-4 text-sm text-muted"><Link href="/history" className="hover:text-foreground">← Market History</Link><Link href="/opportunities" className="hover:text-foreground">Opportunities</Link></div>
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

      <Section title="Investment score">
        <div className="grid gap-6 rounded-lg border border-border bg-surface p-4 lg:grid-cols-2">
          <div className="space-y-4">
            <ScoreBadge result={scoreResult} size="lg" />
            <OutlookTable result={scoreResult} baseSource={base.source} />
            <p className="text-xs text-muted">
              Default weights. <Link href="/opportunities" className="text-accent hover:underline">Change what matters to you</Link> and
              compare with other projects on the Opportunities page.
            </p>
          </div>
          <FactorList factors={factors} result={scoreResult} weights={DEFAULT_WEIGHTS} />
        </div>
        <Disclaimer />
      </Section>

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

      <Section title="Key facts">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {factGroups
            .map((g) => ({ ...g, facts: g.facts.filter(([, v]) => v) }))
            .filter((g) => g.facts.length)
            .map((g) => (
              <div key={g.title} className="rounded-lg border border-border bg-surface p-4">
                <h3 className="mb-2 text-sm font-medium">{g.title}</h3>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {g.facts.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted">{k}</dt>
                      <dd className="first-letter:uppercase">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
        </div>
        {floorRiseExample && (
          <p className="text-sm text-muted">
            Floor rise in practice: a {floorRiseExample.carpet.toLocaleString("en-IN")} sq ft apartment on the top floor
            costs about <span className="text-foreground">{fmtCr(floorRiseExample.extraCr)} more</span> than the same
            apartment on the first floor ({floorRiseExample.floors} floors × ₹{p.floor_rise_psf!.toLocaleString("en-IN")}/sq ft).
          </p>
        )}
      </Section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Apartment types">
          {project.unit_types.length === 0 ? (
            <p className="text-sm text-muted">No unit details yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-normal">Type</th>
                  <th className="py-2 pr-3 font-normal">Carpet area</th>
                  <th className="py-2 pr-3 font-normal">Ticket size</th>
                  <th className="py-2 font-normal">Units</th>
                </tr>
              </thead>
              <tbody>
                {project.unit_types.map((u) => (
                  <tr key={u.id} className="border-b border-border align-top">
                    <td className="py-2 pr-3">{u.config}</td>
                    <td className="py-2 pr-3">{range(u.carpet_sqft_min, u.carpet_sqft_max, (n) => `${n.toLocaleString("en-IN")} sq ft`)}</td>
                    <td className="py-2 pr-3">
                      {range(u.price_min_cr, u.price_max_cr, fmtCr)}
                      {u.notes && <div className="text-xs text-muted">{u.notes}</div>}
                    </td>
                    <td className="py-2">{u.units ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Rent & rental yield">
          <RentSection
            rents={project.rental_points}
            yields={yields}
            medianYield={medianYield}
            areaYield={areaYield ?? null}
            areaYieldUrl={p.micro_market?.rent_yield_source_url ?? null}
            areaName={p.micro_market?.name ?? "the area"}
          />
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

      {costs.length > 0 && (
        <Section title="Costs of buying, owning and selling in Mumbai">
          <CostsTable costs={costs} />
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

function RentSection({
  rents,
  yields,
  medianYield,
  areaYield,
  areaYieldUrl,
  areaName,
}: {
  rents: Project["rental_points"];
  yields: RentYield[];
  medianYield: number | null;
  areaYield: number | null;
  areaYieldUrl: string | null;
  areaName: string;
}) {
  if (!rents.length) return <p className="text-sm text-muted">No rent data yet.</p>;
  const yieldById = new Map(yields.map((y) => [y.rent.id, y]));
  const sorted = [...rents].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-6 text-sm">
        <div>
          <div className="text-xs text-muted">Typical gross yield here</div>
          <div className="text-xl font-semibold">{medianYield != null ? `${(medianYield * 100).toFixed(1)}%` : "—"}</div>
        </div>
        {areaYield != null && (
          <div>
            <div className="text-xs text-muted">{areaName} average</div>
            <div className="text-xl font-semibold">
              {areaYieldUrl ? (
                <a href={areaYieldUrl} target="_blank" rel="noopener noreferrer" className="hover:text-accent">{areaYield}%</a>
              ) : `${areaYield}%`}
            </div>
          </div>
        )}
      </div>
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted">
          <tr className="border-b border-border">
            <th className="py-2 pr-3 font-normal">Date</th>
            <th className="py-2 pr-3 font-normal">Apartment</th>
            <th className="py-2 pr-3 font-normal">Rent / month</th>
            <th className="py-2 font-normal">Yield</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const y = yieldById.get(r.id);
            return (
              <tr key={r.id} className="border-b border-border align-top">
                <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="py-2 pr-3">
                  {r.config}
                  {r.carpet_sqft ? `, ${r.carpet_sqft.toLocaleString("en-IN")} sq ft` : ""}
                  <div className="text-xs text-muted">
                    {[FURNISH_LABEL[r.furnishing], r.kind === "registered" ? "Registered lease" : "Asking rent"].filter(Boolean).join(" · ")}
                  </div>
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {r.source_url ? (
                    <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                      ₹{fmtLakh(r.monthly_rent)}
                    </a>
                  ) : `₹${fmtLakh(r.monthly_rent)}`}
                  <div><ConfidenceBadge c={r.confidence} /></div>
                </td>
                <td className="py-2">
                  {y ? `${(y.grossYield * 100).toFixed(1)}%` : "—"}
                  {y && y.grossYield > IMPLAUSIBLE_YIELD && (
                    <div className="text-xs text-amber-600 dark:text-amber-400">Unusually high; rent and price may use different areas</div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted">
        Gross yield = yearly rent ÷ (carpet area × the closest carpet ₹/sq ft price). Yields above 7% are left out of the typical figure, because they almost always come from a rent and a price measured on different areas. It ignores maintenance, property
        tax, vacancy and income tax, so the net yield is lower. A bank FD pays about 6.5% for comparison.
      </p>
    </div>
  );
}

function CostsTable({ costs }: { costs: CostItem[] }) {
  const order = ["buying", "holding", "renting", "selling"] as const;
  const label = { buying: "When buying", holding: "While owning", renting: "If you rent it out", selling: "When selling" };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {order.map((stage) => {
        const items = costs.filter((c) => c.stage === stage);
        if (!items.length) return null;
        return (
          <div key={stage} className="rounded-lg border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-medium">{label[stage]}</h3>
            <ul className="space-y-2 text-sm">
              {items.map((c) => (
                <li key={c.key}>
                  <div className="flex flex-wrap justify-between gap-x-3">
                    <span className="text-muted">{c.name}</span>
                    {c.source_url ? (
                      <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">{c.value}</a>
                    ) : <span>{c.value}</span>}
                  </div>
                  {(c.applies_to || c.note) && (
                    <div className="text-xs text-muted">{[c.applies_to, c.note].filter(Boolean).join(" · ")}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <p className="text-xs text-muted md:col-span-2">
        General rules, checked on the dates in the sources. Tax rules change; confirm with a chartered accountant before buying.
      </p>
    </div>
  );
}

function fmtLakh(n: number): string {
  return n >= 100000 ? `${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 2)} lakh` : n.toLocaleString("en-IN");
}

function range<T extends number>(min: T | null, max: T | null, f: (n: T) => string): string {
  if (min != null && max != null && min !== max) return `${f(min)} – ${f(max)}`;
  if (min != null) return f(min);
  if (max != null) return f(max);
  return "—";
}
