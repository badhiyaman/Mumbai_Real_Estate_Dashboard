import OpportunityBoard, { type OpportunityItem } from "@/components/OpportunityBoard";
import { Disclaimer } from "@/components/ScoreBreakdown";
import { toCard } from "@/lib/cards";
import { getProjects } from "@/lib/queries";
import { baseCagrFor, buildContext, FD_RATE, marketBaseRates, scoreFactors } from "@/lib/scoring";

export const revalidate = 600;

export default async function OpportunitiesPage() {
  const projects = await getProjects();
  const ctx = buildContext(projects);
  const items: OpportunityItem[] = projects.map((p) => {
    const base = baseCagrFor(p, ctx);
    return { card: toCard(p), factors: scoreFactors(p, ctx), baseCagr: base.value, baseSource: base.source };
  });
  const rates = marketBaseRates(projects);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="max-w-3xl text-muted">
          Each project gets a 0–100 score from eight factors, such as the area&apos;s past growth, infrastructure still to open,
          the developer&apos;s record and the price compared with nearby projects. You also get a likely price range over 3, 5 and
          7 years. Missing data is never counted as good or bad; it just widens the range. Adjust the weights to match what
          matters to you.
        </p>
      </div>

      {rates.count > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4 text-sm">
          <span className="font-medium">Reality check from the data so far: </span>
          of {rates.count} projects with 2+ years of prices, {rates.rose} rose and only {rates.beatFd} beat a{" "}
          {(FD_RATE * 100).toFixed(1)}% bank FD
          {rates.median != null ? `. The median was ${(rates.median * 100).toFixed(1)}% a year` : ""}. A high score means
          &ldquo;better than its peers on the evidence we have&rdquo;, not a guaranteed gain.
        </div>
      )}

      <Disclaimer />
      <OpportunityBoard items={items} />
    </div>
  );
}
