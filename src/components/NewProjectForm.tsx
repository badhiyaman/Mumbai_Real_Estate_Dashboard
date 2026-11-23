"use client";

import { useActionState } from "react";
import { createProject } from "@/app/admin/actions";

type Opt = { slug: string; name: string };

export default function NewProjectForm({ developers, areas }: { developers: Opt[]; areas: Opt[] }) {
  const [state, action, pending] = useActionState(createProject, null);
  const field = "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";
  const label = "block space-y-1 text-xs text-muted";
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className={label}><span>Project name</span><input name="name" required className={field} /></label>
      <label className={label}>
        <span>Developer</span>
        <select name="developer" required defaultValue="" className={field}>
          <option value="" disabled>Choose…</option>
          {developers.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
        </select>
      </label>
      <label className={label}>
        <span>Area</span>
        <select name="area" required defaultValue="" className={field}>
          <option value="" disabled>Choose…</option>
          {areas.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
        </select>
      </label>
      <label className={label}>
        <span>Status</span>
        <select name="status" defaultValue="under_construction" className={field}>
          <option value="upcoming">Upcoming</option>
          <option value="under_construction">Under construction</option>
          <option value="completed">Completed</option>
        </select>
      </label>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
        <button disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {pending ? "Creating…" : "Create and add details"}
        </button>
        {state?.error && <span className="text-sm text-red-600 dark:text-red-400">{state.error}</span>}
      </div>
      <p className="text-xs text-muted sm:col-span-2 lg:col-span-4">
        Developer or area missing? Add it to data/seed/developers.json or micro_markets.json and run npm run seed.
      </p>
    </form>
  );
}
