import { readClient } from "./supabase";
import type { CostItem, Project, ProjectNewsItem } from "./types";

const PROJECT_SELECT = `
  *,
  developer:developers(*),
  micro_market:micro_markets(*),
  unit_types(*),
  price_points(*),
  rental_points(*)
`;

export async function getCostItems(): Promise<CostItem[]> {
  const { data, error } = await readClient().from("cost_items").select("*").order("stage");
  if (error) throw new Error(error.message);
  return (data ?? []) as CostItem[];
}

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await readClient().from("projects").select(PROJECT_SELECT).order("launch_date");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Project[];
}

export async function getProject(slug: string): Promise<Project | null> {
  const { data, error } = await readClient().from("projects").select(PROJECT_SELECT).eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as Project | null;
}

export interface NewsArticle {
  id: number;
  url: string;
  title: string;
  source: string | null;
  published_at: string | null;
  snippet: string | null;
  topics: string[];
  micro_market_slugs: string[];
  developer_slugs: string[];
  created_at: string;
  projects: { slug: string; name: string }[];
  fromResearch: boolean; // found while researching a project (often years old), not by the daily job
}

/** The newest articles (by publish date), with the projects each one is linked to. */
export async function getNews(limit = 600): Promise<NewsArticle[]> {
  const { data, error } = await readClient()
    .from("news_articles")
    .select("*, project_news(origin, project:projects(slug, name))")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  type Row = Omit<NewsArticle, "projects" | "fromResearch"> & {
    project_news: { origin: string; project: { slug: string; name: string } | null }[];
  };
  return ((data ?? []) as unknown as Row[]).map(({ project_news, ...a }) => ({
    ...a,
    projects: project_news.map((l) => l.project).filter((p): p is { slug: string; name: string } => !!p),
    fromResearch: project_news.some((l) => l.origin === "research"),
  }));
}

export async function getNames(): Promise<{ areas: Record<string, string>; developers: Record<string, string> }> {
  const db = readClient();
  const [a, d] = await Promise.all([db.from("micro_markets").select("slug, name"), db.from("developers").select("slug, name")]);
  if (a.error || d.error) throw new Error((a.error ?? d.error)!.message);
  const map = (rows: { slug: string; name: string }[]) =>
    Object.fromEntries(rows.map((r) => [r.slug, r.name.replace(/\s*\(.*\)\s*$/, "")]));
  return { areas: map(a.data ?? []), developers: map(d.data ?? []) };
}

export async function getProjectNews(projectId: number): Promise<ProjectNewsItem[]> {
  const { data, error } = await readClient()
    .from("project_news")
    .select("event_type, origin, article:news_articles(id, url, title, source, published_at, snippet)")
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  const items = (data ?? []) as unknown as ProjectNewsItem[];
  return items.sort((a, b) => (b.article.published_at ?? "").localeCompare(a.article.published_at ?? ""));
}
