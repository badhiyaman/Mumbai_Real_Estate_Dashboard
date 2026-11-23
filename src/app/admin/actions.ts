"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdmin, passwordMatches, SESSION_COOKIE, SESSION_DAYS, sessionToken } from "@/lib/auth";
import { slugify } from "@/lib/edit-fields";
import { adminClient } from "@/lib/supabase";

export async function signIn(_prev: { error: string } | null, form: FormData): Promise<{ error: string } | null> {
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/admin");
  if (!process.env.ADMIN_PASSWORD) return { error: "Editing is turned off: ADMIN_PASSWORD isn't set on the server." };
  if (!passwordMatches(password)) {
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    return { error: "Wrong password." };
  }
  (await cookies()).set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
  // Only allow redirects within this site.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/admin");
}

export async function createProject(_prev: { error: string } | null, form: FormData): Promise<{ error: string } | null> {
  if (!(await isAdmin())) return { error: "Not signed in." };
  const name = String(form.get("name") ?? "").trim();
  const developer = String(form.get("developer") ?? "");
  const area = String(form.get("area") ?? "");
  const status = String(form.get("status") ?? "");
  if (name.length < 3) return { error: "Add the project's name." };
  if (!["completed", "under_construction", "upcoming"].includes(status)) return { error: "Pick a status." };
  const db = adminClient();
  const [{ data: dev }, { data: mm }] = await Promise.all([
    db.from("developers").select("id").eq("slug", developer).maybeSingle(),
    db.from("micro_markets").select("id").eq("slug", area).maybeSingle(),
  ]);
  if (!dev) return { error: "Pick a developer." };
  if (!mm) return { error: "Pick an area." };
  const base = slugify(name);
  if (!base) return { error: "The name needs some letters or numbers." };
  // Make the web address unique if a project with the same name exists.
  const { data: taken } = await db.from("projects").select("slug").like("slug", `${base}%`);
  const used = new Set((taken ?? []).map((t) => t.slug));
  let slug = base;
  for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
  const { error } = await db.from("projects").insert({
    slug,
    name,
    developer_id: dev.id,
    micro_market_id: mm.id,
    status,
    created_in_app: true,
    manual_overrides: {},
  });
  if (error) return { error: error.message };
  revalidatePath("/history");
  revalidatePath("/opportunities");
  redirect(`/projects/${slug}/edit`);
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}
