import InsightsStrip from "@/components/InsightsStrip";
import ProjectGallery from "@/components/ProjectGallery";
import { toCard } from "@/lib/cards";
import { getProjects } from "@/lib/queries";

export const revalidate = 600; // refresh data from the database every 10 minutes

export default async function HistoryPage() {
  const projects = await getProjects();
  const cards = projects.map(toCard);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Market History</h1>
        <p className="max-w-3xl text-muted">
          Major Mumbai projects since about 2010 with tickets above ₹5 Cr. Growth is measured from the earliest
          to the latest price we have for each project, using the same area basis (carpet or saleable) for
          both ends. Click a project for its full price timeline and news.
        </p>
      </div>
      {cards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted">
          No projects in the database yet. Run <code>npm run seed</code> to load them.
        </p>
      ) : (
        <>
          <InsightsStrip projects={projects} />
          <h2 className="pt-2 text-lg font-medium">All projects</h2>
          <ProjectGallery cards={cards} />
        </>
      )}
    </div>
  );
}
