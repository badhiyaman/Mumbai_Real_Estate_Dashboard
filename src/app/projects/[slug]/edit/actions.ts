"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isDate, isUrl, parseField, PROJECT_FIELDS, STAGES } from "@/lib/edit-fields";
import { adminClient } from "@/lib/supabase";

export type FormState = { ok?: string; error?: string } | null;

async function projectBySlug(slug: string) {
  const { data, error } = await adminClient().from("projects").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Project not found");
  return data as Record<string, unknown> & { id: number; manual_overrides: Record<string, unknown> };
}

function refresh(slug: string) {
  for (const p of [`/projects/${slug}`, `/projects/${slug}/edit`, "/history", "/opportunities", "/news"]) revalidatePath(p);
}

const fail = (e: unknown): FormState => ({ error: e instanceof Error ? e.message : String(e) });

export async function updateProject(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  try {
    await requireAdmin();
    const current = await projectBySlug(slug);
    const changes: Record<string, unknown> = {};
    for (const f of PROJECT_FIELDS) {
      const r = parseField(f, form.get(f.key));
      if (!r.ok) return { error: r.error };
      const before = current[f.key] ?? null;
      const norm = (v: unknown) => (v == null ? null : typeof v === "number" ? Number(v) : String(v));
      if (norm(before) !== norm(r.value)) changes[f.key] = r.value;
    }
    if (!Object.keys(changes).length) return { ok: "Nothing changed." };
    const { error } = await adminClient()
      .from("projects")
      .update({ ...changes, manual_overrides: { ...current.manual_overrides, ...changes }, updated_at: new Date().toISOString() })
      .eq("id", current.id);
    if (error) throw new Error(error.message);
    refresh(slug);
    return { ok: `Saved ${Object.keys(changes).length} change${Object.keys(changes).length === 1 ? "" : "s"}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function addPricePoint(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  try {
    await requireAdmin();
    const p = await projectBySlug(slug);
    const get = (k: string) => String(form.get(k) ?? "").trim();
    const date = get("date");
    const price = Number(get("price_psf").replace(/,/g, ""));
    const stage = get("stage");
    const basis = get("basis");
    const confidence = get("confidence");
    const url = get("source_url");
    if (!isDate(date)) return { error: "Pick a date." };
    if (!Number.isFinite(price) || price < 3000 || price > 400000) return { error: "Price should be ₹3,000–4,00,000 per sq ft." };
    if (!STAGES.some((s) => s.value === stage)) return { error: "Pick a stage." };
    if (!["carpet", "saleable", "unknown"].includes(basis)) return { error: "Pick an area basis." };
    if (!["high", "medium", "low"].includes(confidence)) return { error: "Pick a confidence level." };
    if (!isUrl(url)) return { error: "Add a source link (http…), so the figure can be checked later." };
    const { error } = await adminClient().from("price_points").insert({
      project_id: p.id,
      date,
      date_precision: get("date_precision") || "day",
      stage,
      price_psf: price,
      basis,
      confidence,
      source_name: get("source_name") || new URL(url).hostname.replace(/^www\./, ""),
      source_url: url,
      note: get("note") || null,
      source: "app",
    });
    if (error) throw new Error(error.message);
    refresh(slug);
    return { ok: "Price added." };
  } catch (e) {
    return fail(e);
  }
}

export async function addRentalPoint(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  try {
    await requireAdmin();
    const p = await projectBySlug(slug);
    const get = (k: string) => String(form.get(k) ?? "").trim();
    const date = get("date");
    const rent = Number(get("monthly_rent").replace(/,/g, ""));
    const sqft = get("carpet_sqft") ? Number(get("carpet_sqft").replace(/,/g, "")) : null;
    const url = get("source_url");
    if (!isDate(date)) return { error: "Pick a date." };
    if (!get("config")) return { error: "Add the apartment type, e.g. 3 BHK." };
    if (!Number.isFinite(rent) || rent < 20000 || rent > 5000000) return { error: "Rent should be ₹20,000–50,00,000 a month." };
    if (sqft != null && (!Number.isInteger(sqft) || sqft < 200 || sqft > 30000)) return { error: "Carpet area should be 200–30,000 sq ft." };
    if (!isUrl(url)) return { error: "Add a source link (http…)." };
    const { error } = await adminClient().from("rental_points").insert({
      project_id: p.id,
      date,
      config: get("config"),
      carpet_sqft: sqft,
      monthly_rent: rent,
      furnishing: get("furnishing") || "unknown",
      kind: get("kind") === "registered" ? "registered" : "asking",
      confidence: ["high", "medium", "low"].includes(get("confidence")) ? get("confidence") : "low",
      source_name: new URL(url).hostname.replace(/^www\./, ""),
      source_url: url,
      note: get("note") || null,
      source: "app",
    });
    if (error) throw new Error(error.message);
    refresh(slug);
    return { ok: "Rent added." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRow(slug: string, table: "price_points" | "rental_points", id: number): Promise<FormState> {
  try {
    await requireAdmin();
    if (table !== "price_points" && table !== "rental_points") throw new Error("Not allowed");
    if (!Number.isInteger(id)) throw new Error("Bad id");
    const p = await projectBySlug(slug);
    const { error } = await adminClient().from(table).delete().eq("id", id).eq("project_id", p.id);
    if (error) throw new Error(error.message);
    refresh(slug);
    return { ok: "Removed." };
  } catch (e) {
    return fail(e);
  }
}

export async function addNewsLink(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  try {
    await requireAdmin();
    const p = await projectBySlug(slug);
    const get = (k: string) => String(form.get(k) ?? "").trim();
    const url = get("url");
    const title = get("title");
    const date = get("date");
    if (!isUrl(url)) return { error: "Add the article link (http…)." };
    if (!title) return { error: "Add the headline." };
    if (date && !isDate(date)) return { error: "Pick a valid date." };
    const db = adminClient();
    const { data: art, error } = await db
      .from("news_articles")
      .upsert(
        { url, title: title.slice(0, 300), source: get("source") || new URL(url).hostname.replace(/^www\./, ""), published_at: date || null, snippet: get("summary") || null },
        { onConflict: "url" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { error: le } = await db
      .from("project_news")
      .upsert({ project_id: p.id, article_id: art.id, event_type: get("event_type") || "other", origin: "manual" }, { onConflict: "project_id,article_id" });
    if (le) throw new Error(le.message);
    refresh(slug);
    return { ok: "News linked." };
  } catch (e) {
    return fail(e);
  }
}
