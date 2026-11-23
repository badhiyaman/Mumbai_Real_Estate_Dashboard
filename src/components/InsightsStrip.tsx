import Link from "next/link";
import type { GroupStat } from "@/lib/insights";
import { byArea, byDeveloper, timing } from "@/lib/insights";
import type { Project } from "@/lib/types";

const FD = 0.065;
const pct = (x: number | null, d = 1) => (x == null ? "—" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(d)}%`);
const growthClass = (x: number | null) =>
  x == null ? "text-muted" : x >= FD ? "text-emerald-600 dark:text-emerald-400" : x >= 0 ? "" : "text-red-600 dark:text-red-400";

export default function InsightsStrip({ projects }: { projects: Project[] }) {
  const areas = byArea(projects).filter((g) => g.withGrowth > 0);
  const devs = byDeveloper(projects).filter((g) => g.withGrowth > 0);
  const t = timing(projects);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">What the data says</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="By area" note="Median yearly growth of each area's projects. Green beats a 6.5% bank FD.">
          <GroupTable rows={areas} showPsf />
        </Panel>
        <Panel title="By developer" note="Median yearly growth, and average delay on delivered or overdue projects.">
          <GroupTable rows={devs} showDelay />
        </Panel>
        <Panel title="Buy at launch, or once it's finished?" note={`Projects with prices at both launch and completion (${t.rows.length} so far).`}>
          {t.rows.length === 0 ? (
            <p className="text-sm text-muted">Not enough projects with both launch and completion prices yet.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-muted">During construction</dt>
                  <dd className={`text-xl font-semibold ${growthClass(t.medianBuild)}`}>{pct(t.medianBuild)}/yr</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">After completion</dt>
                  <dd className={`text-xl font-semibold ${growthClass(t.medianAfter)}`}>{t.pairs ? `${pct(t.medianAfter)}/yr` : "—"}</dd>
                </div>
              </dl>
              {t.pairs > 0 && (
                <p className="text-muted">
                  Buying at launch grew faster in {t.earlyWon} of {t.pairs} projects. Early buyers take on delay and delivery
                  risk in exchange, and pay 5% GST that ready flats don&apos;t.
                </p>
              )}
              <ul className="space-y-1">
                {t.rows.map((r) => (
                  <li key={r.slug} className="flex justify-between gap-3">
                    <Link href={`/projects/${r.slug}`} className="truncate hover:text-accent">{r.name}</Link>
                    <span className="shrink-0 tabular-nums">
                      <span className={growthClass(r.build)}>{pct(r.build)}</span>
                      <span className="text-muted"> → </span>
                      <span className={growthClass(r.after)}>{pct(r.after)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>
      <p className="text-xs text-muted">
        Small samples: most areas and developers have only 1–4 projects with enough price history, so treat these as patterns
        to investigate, not rules.
      </p>
    </section>
  );
}

function Panel({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mb-3 text-xs text-muted">{note}</p>
      {children}
    </div>
  );
}

function GroupTable({ rows, showPsf, showDelay }: { rows: GroupStat[]; showPsf?: boolean; showDelay?: boolean }) {
  if (!rows.length) return <p className="text-sm text-muted">Not enough price history yet.</p>;
  const top = rows.slice(0, 7);
  const rest = rows.slice(7);
  const Row = ({ g }: { g: GroupStat }) => (
    <tr className="border-b border-border align-top">
      <td className="py-1.5 pr-2">
        {g.name}
        <div className="text-xs text-muted">
          {g.withGrowth} of {g.projects} with history
          {g.best && g.withGrowth > 1 ? (
            <>
              {" "}· best: <Link href={`/projects/${g.best.slug}`} className="hover:text-accent">{g.best.name.split(" (")[0]}</Link>
            </>
          ) : null}
        </div>
      </td>
      <td className={`py-1.5 pr-2 text-right tabular-nums ${growthClass(g.medianCagr)}`}>{pct(g.medianCagr)}</td>
      {showPsf && (
        <td className="py-1.5 text-right tabular-nums text-muted">
          {g.medianPsf ? `₹${Math.round(g.medianPsf / 1000)}k` : "—"}
        </td>
      )}
      {showDelay && (
        <td className="py-1.5 text-right tabular-nums text-muted">
          {g.avgDelayMonths == null ? "—" : g.avgDelayMonths < 1 ? "on time" : `${Math.round(g.avgDelayMonths)} mo`}
        </td>
      )}
    </tr>
  );
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-muted">
        <tr className="border-b border-border">
          <th className="py-1.5 text-left font-normal">{showPsf ? "Area" : "Developer"}</th>
          <th className="py-1.5 text-right font-normal">Growth/yr</th>
          {showPsf && <th className="py-1.5 text-right font-normal" title="Median latest carpet price">₹/sq ft</th>}
          {showDelay && <th className="py-1.5 text-right font-normal">Avg delay</th>}
        </tr>
      </thead>
      <tbody>
        {top.map((g) => <Row key={g.key} g={g} />)}
        {rest.length > 0 && (
          <tr>
            <td colSpan={3} className="pt-2 text-xs text-muted">
              <details>
                <summary className="cursor-pointer">{rest.length} more</summary>
                <table className="mt-1 w-full text-sm"><tbody>{rest.map((g) => <Row key={g.key} g={g} />)}</tbody></table>
              </details>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
