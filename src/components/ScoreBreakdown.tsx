// Presentational pieces shared by the Opportunities page and project pages. No hooks, so it works
// in both server and client components.
import { FACTORS, FD_RATE, type FactorResult, type ScoreResult, type Weights } from "@/lib/scoring";

const pct = (x: number, d = 0) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(d)}%`;

export function scoreColor(score: number | null) {
  if (score == null) return "text-muted";
  if (score >= 65) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 45) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

const CONF_LABEL = { good: "Good data", fair: "Some gaps", thin: "Thin data" } as const;
const CONF_CLASS = {
  good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  fair: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  thin: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
} as const;

export function ScoreBadge({ result, size = "md" }: { result: ScoreResult; size?: "md" | "lg" }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={`${size === "lg" ? "text-4xl" : "text-2xl"} font-semibold tabular-nums ${scoreColor(result.score)}`}>
        {result.score != null ? Math.round(result.score) : "—"}
      </span>
      <span className="text-xs text-muted">/ 100</span>
      <span
        className={`rounded px-1.5 py-0.5 text-xs ${CONF_CLASS[result.confidence]}`}
        title={`${Math.round(result.coverage * 100)}% of the scoring weight had data`}
      >
        {CONF_LABEL[result.confidence]}
      </span>
    </div>
  );
}

export function OutlookTable({ result, baseSource }: { result: ScoreResult; baseSource: string }) {
  const o = result.outlook;
  if (!o) return <p className="text-sm text-muted">Not enough price history in the data to project a range.</p>;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{o.verdict}</p>
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted">
          <tr className="border-b border-border">
            <th className="py-1.5 pr-3 font-normal">Holding period</th>
            <th className="py-1.5 pr-3 font-normal">Likely price change</th>
            <th className="py-1.5 font-normal">Bank FD for comparison</th>
          </tr>
        </thead>
        <tbody>
          {o.horizons.map((h) => (
            <tr key={h.years} className="border-b border-border">
              <td className="py-1.5 pr-3">{h.years} years</td>
              <td className="py-1.5 pr-3 tabular-nums">
                {pct(h.low)} to {pct(h.high)} <span className="text-muted">(middle {pct(h.mid)})</span>
              </td>
              <td className="py-1.5 tabular-nums text-muted">{pct(Math.pow(1 + FD_RATE, h.years) - 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted">
        Range: {pct(o.low, 1)} to {pct(o.high, 1)} a year. Starting point: {baseSource} {pct(o.base, 1)}/yr. That is then
        adjusted by the score (up to ±3 points) and widened when data is missing. Prices are before stamp duty, GST and
        selling costs.
      </p>
    </div>
  );
}

export function FactorList({
  factors,
  result,
  weights,
}: {
  factors: FactorResult[];
  result: ScoreResult;
  weights: Weights;
}) {
  const share = new Map(result.contributions.map((c) => [c.key, c.share]));
  return (
    <ul className="space-y-3">
      {FACTORS.map((info) => {
        const f = factors.find((x) => x.key === info.key);
        const off = weights[info.key] === 0;
        return (
          <li key={info.key} className={off ? "opacity-50" : ""}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{info.label}</span>
              <span className={`tabular-nums ${scoreColor(f?.score ?? null)}`}>
                {f?.score != null ? Math.round(f.score) : "no data"}
                {share.has(info.key) && (
                  <span className="ml-2 text-xs text-muted">{Math.round((share.get(info.key) ?? 0) * 100)}% of score</span>
                )}
                {off && <span className="ml-2 text-xs text-muted">switched off</span>}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-border">
              {f?.score != null && (
                <div className="h-full rounded bg-accent" style={{ width: `${Math.max(2, f.score)}%` }} />
              )}
            </div>
            <p className="mt-1 text-xs text-muted">{f?.detail}</p>
          </li>
        );
      })}
    </ul>
  );
}

export function Disclaimer() {
  return (
    <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted">
      <span className="font-medium text-foreground">Educational estimate, not financial advice.</span> The score is a simple,
      transparent model built on approximate public prices, and past growth doesn&apos;t guarantee future growth. Before buying,
      check the MahaRERA filings and title, and speak to a SEBI-registered investment adviser and a property lawyer.
    </p>
  );
}
