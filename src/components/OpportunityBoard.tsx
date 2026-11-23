"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ProjectCard } from "@/lib/cards";
import { fmtCr, fmtPsf, STATUS_LABEL } from "@/lib/metrics";
import { combine, DEFAULT_WEIGHTS, FACTORS, type FactorResult, type Weights } from "@/lib/scoring";
import { FactorList, OutlookTable, ScoreBadge } from "./ScoreBreakdown";

export interface OpportunityItem {
  card: ProjectCard;
  factors: FactorResult[];
  baseCagr: number | null;
  baseSource: string;
}

type Scope = "pipeline" | "completed" | "all";
type SortKey = "score" | "outlook" | "price" | "possession";

const WEIGHTS_KEY = "opportunities.weights.v1";
const pct = (x: number, d = 0) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(d)}%`;

function loadWeights(): Weights {
  try {
    const raw = localStorage.getItem(WEIGHTS_KEY);
    if (raw) return { ...DEFAULT_WEIGHTS, ...(JSON.parse(raw) as Partial<Weights>) };
  } catch {
    /* storage unavailable: use defaults */
  }
  return DEFAULT_WEIGHTS;
}

export default function OpportunityBoard({ items }: { items: OpportunityItem[] }) {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [scope, setScope] = useState<Scope>("pipeline");
  const [area, setArea] = useState("");
  const [maxTicket, setMaxTicket] = useState("");
  const [sort, setSort] = useState<SortKey>("score");
  const [showWeights, setShowWeights] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => setWeights(loadWeights()), []);
  const updateWeight = (k: keyof Weights, v: number) => {
    const next = { ...weights, [k]: v };
    setWeights(next);
    try {
      localStorage.setItem(WEIGHTS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  const resetWeights = () => {
    setWeights(DEFAULT_WEIGHTS);
    try {
      localStorage.removeItem(WEIGHTS_KEY);
    } catch {
      /* ignore */
    }
  };
  const changed = FACTORS.some((f) => weights[f.key] !== DEFAULT_WEIGHTS[f.key]);

  const scored = useMemo(
    () => items.map((it) => ({ ...it, result: combine(it.factors, weights, it.baseCagr) })),
    [items, weights],
  );
  const areas = useMemo(() => [...new Set(items.map((i) => i.card.area))].sort(), [items]);

  const shown = useMemo(() => {
    const list = scored.filter(({ card }) => {
      if (scope === "pipeline" && card.status === "completed") return false;
      if (scope === "completed" && card.status !== "completed") return false;
      if (area && card.area !== area) return false;
      if (maxTicket && (card.minTicketCr == null || card.minTicketCr > +maxTicket)) return false;
      return true;
    });
    const val = (x: (typeof list)[number]) => {
      switch (sort) {
        case "score": return x.result.score ?? -1;
        case "outlook": return x.result.outlook?.mid ?? -1;
        case "price": return -(x.card.latestPsf ?? Infinity);
        case "possession": return -(x.card.possession?.startsWith("Due") ? Date.parse(x.card.possession.slice(4)) || Infinity : Infinity);
      }
    };
    return list.sort((a, b) => val(b) - val(a));
  }, [scored, scope, area, maxTicket, sort]);

  const field = "w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm";
  const label = "block space-y-1 text-xs text-muted";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-4">
        <label className={label}>
          <span>Show</span>
          <select className={field} value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
            <option value="pipeline">Upcoming & under construction</option>
            <option value="completed">Completed (resale)</option>
            <option value="all">All projects</option>
          </select>
        </label>
        <label className={label}>
          <span>Area</span>
          <select className={field} value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">All</option>
            {areas.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className={label}>
          <span>Max starting ticket (₹ Cr)</span>
          <input className={field} type="number" min={0} value={maxTicket} onChange={(e) => setMaxTicket(e.target.value)} placeholder="e.g. 15" />
        </label>
        <label className={label}>
          <span>Sort by</span>
          <select className={field} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="score">Score</option>
            <option value="outlook">Expected yearly growth</option>
            <option value="price">Lowest ₹/sq ft</option>
            <option value="possession">Soonest possession</option>
          </select>
        </label>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <button
          onClick={() => setShowWeights((s) => !s)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm"
          aria-expanded={showWeights}
        >
          <span>
            <span className="font-medium">What matters to you?</span>{" "}
            <span className="text-muted">Adjust how much each factor counts{changed ? " (customised)" : ""}</span>
          </span>
          <span className="text-muted">{showWeights ? "Hide" : "Show"}</span>
        </button>
        {showWeights && (
          <div className="space-y-4 border-t border-border p-4">
            <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
              {FACTORS.map((f) => (
                <label key={f.key} className="block space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{f.label}</span>
                    <span className="tabular-nums text-muted">{weights[f.key] === 0 ? "off" : weights[f.key]}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    step={5}
                    value={weights[f.key]}
                    onChange={(e) => updateWeight(f.key, +e.target.value)}
                    className="w-full accent-[var(--accent)]"
                  />
                  <span className="block text-xs text-muted">{f.question}</span>
                </label>
              ))}
            </div>
            <button onClick={resetWeights} disabled={!changed} className="text-sm text-accent disabled:text-muted">
              Reset to default weights
            </button>
          </div>
        )}
      </div>

      <div className="text-sm text-muted">{shown.length} project{shown.length === 1 ? "" : "s"}</div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted">No projects match these filters.</p>
      ) : (
        <ol className="space-y-3">
          {shown.map(({ card, factors, result, baseSource }, i) => {
            const isOpen = open === card.slug;
            const top = [...result.contributions].sort((a, b) => b.score - a.score);
            const best = top.slice(0, 2).filter((c) => c.score >= 55);
            const worst = top.filter((c) => c.score < 40).slice(-1);
            const five = result.outlook?.horizons.find((h) => h.years === 5);
            return (
              <li key={card.slug} className="rounded-lg border border-border bg-surface">
                <div className="grid gap-4 p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                  <div className="flex items-center gap-4 md:block md:w-36">
                    <span className="text-xs text-muted">#{i + 1}</span>
                    <ScoreBadge result={result} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Link href={`/projects/${card.slug}`} className="font-medium hover:text-accent">{card.name}</Link>
                    <p className="text-sm text-muted">
                      {card.developer} · {card.area} · {STATUS_LABEL[card.status]}
                      {card.possession ? ` · ${card.possession}` : ""}
                    </p>
                    <p className="text-sm">
                      {card.latestPsf ? fmtPsf(card.latestPsf) : "Price unknown"}
                      {card.latestBasis && card.latestBasis !== "carpet" ? <span className="text-muted"> ({card.latestBasis === "unknown" ? "basis unclear" : card.latestBasis})</span> : null}
                      {card.minTicketCr ? <span className="text-muted"> · from {fmtCr(card.minTicketCr)}</span> : null}
                    </p>
                    {(best.length > 0 || worst.length > 0) && (
                      <p className="text-xs text-muted">
                        {best.length > 0 && <>Strengths: {best.map((c) => FACTORS.find((f) => f.key === c.key)!.label.toLowerCase()).join(", ")}. </>}
                        {worst.length > 0 && <>Watch: {FACTORS.find((f) => f.key === worst[0].key)!.label.toLowerCase()}.</>}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1 text-sm md:w-56 md:text-right">
                    {five ? (
                      <>
                        <div className="text-xs text-muted">Likely in 5 years</div>
                        <div className="tabular-nums">{pct(five.low)} to {pct(five.high)}</div>
                      </>
                    ) : <div className="text-xs text-muted">No outlook: too little data</div>}
                    <button onClick={() => setOpen(isOpen ? null : card.slug)} className="text-xs text-accent" aria-expanded={isOpen}>
                      {isOpen ? "Hide why" : "Why this score?"}
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="grid gap-6 border-t border-border p-4 lg:grid-cols-2">
                    <FactorList factors={factors} result={result} weights={weights} />
                    <OutlookTable result={result} baseSource={baseSource} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
