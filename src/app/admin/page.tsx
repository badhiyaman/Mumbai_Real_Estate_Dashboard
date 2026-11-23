import Link from "next/link";
import NewProjectForm from "@/components/NewProjectForm";
import SignInForm from "@/components/SignInForm";
import { isAdmin } from "@/lib/auth";
import { STATUS_LABEL } from "@/lib/metrics";
import { getNames } from "@/lib/queries";
import { readClient } from "@/lib/supabase";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Mumbai Real Estate Dashboard", robots: { index: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) return <SignInForm next="/admin" />;
  const [names, { data: projects, error }] = await Promise.all([
    getNames(),
    readClient().from("projects").select("slug, name, status, created_in_app, manual_overrides").order("name"),
  ]);
  if (error) throw new Error(error.message);
  const opts = (m: Record<string, string>) => Object.entries(m).map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <form action={signOut}>
          <button className="text-sm text-muted hover:text-foreground">Sign out</button>
        </form>
      </div>

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-medium">Add a project</h2>
        <NewProjectForm developers={opts(names.developers)} areas={opts(names.areas)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Edit a project</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(projects ?? []).map((p) => {
            const edits = Object.keys((p.manual_overrides as Record<string, unknown>) ?? {}).length;
            return (
              <li key={p.slug}>
                <Link href={`/projects/${p.slug}/edit`} className="block rounded-md border border-border bg-surface px-3 py-2 text-sm hover:border-accent">
                  {p.name}
                  <span className="block text-xs text-muted">
                    {STATUS_LABEL[p.status as keyof typeof STATUS_LABEL]}
                    {p.created_in_app ? " · added on the website" : ""}
                    {edits ? ` · ${edits} field${edits === 1 ? "" : "s"} edited` : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
