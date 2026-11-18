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

export async function getProjectNews(projectId: number): Promise<ProjectNewsItem[]> {
  const { data, error } = await readClient()
    .from("project_news")
    .select("event_type, origin, article:news_articles(id, url, title, source, published_at, snippet)")
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  const items = (data ?? []) as unknown as ProjectNewsItem[];
  return items.sort((a, b) => (b.article.published_at ?? "").localeCompare(a.article.published_at ?? ""));
}
