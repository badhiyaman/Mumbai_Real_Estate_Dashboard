import NewsFeed from "@/components/NewsFeed";
import { getNames, getNews } from "@/lib/queries";

export const revalidate = 600; // the daily job adds stories; pages refresh every 10 minutes

export default async function NewsPage() {
  const [articles, names] = await Promise.all([getNews(), getNames()]);
  const lastAdded = articles.reduce<string | null>((m, a) => (m == null || a.created_at > m ? a.created_at : m), null);
  // Server render time, passed to the client so "Today" labels match on server and client.
  const now = Date.now();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">News</h1>
        <p className="max-w-3xl text-muted">
          Mumbai real estate news, collected every day from Google News searches, ET Realty, Hindustan Times and Free Press
          Journal. Stories are kept only if they mention a Mumbai/MMR place and real estate, then tagged by topic, area,
          developer and the projects in this dashboard.
        </p>
        {lastAdded && (
          <p className="text-xs text-muted">
            Last new story added{" "}
            {new Date(lastAdded).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST.
          </p>
        )}
      </div>
      <NewsFeed articles={articles} names={names} now={now} />
    </div>
  );
}
