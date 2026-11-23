"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import type { FormState } from "@/app/projects/[slug]/edit/actions";
import { PROJECT_FIELDS, STAGES } from "@/lib/edit-fields";

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

const field = "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";
const label = "block space-y-1 text-xs text-muted";

function Status({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <span className={`text-sm ${state.error ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`} role="status">
      {state.error ?? state.ok}
    </span>
  );
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
      {pending ? "Saving…" : children}
    </button>
  );
}

export function ProjectDetailsForm({ values, action, overridden }: { values: Record<string, unknown>; action: Action; overridden: string[] }) {
  const [state, run, pending] = useActionState(action, null);
  const groups = [...new Set(PROJECT_FIELDS.map((f) => f.group))];
  const val = (k: string) => (values[k] == null ? "" : String(values[k]));
  return (
    <form action={run} className="space-y-5">
      {groups.map((g) => (
        <fieldset key={g} className="space-y-3">
          <legend className="text-sm font-medium">{g}</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PROJECT_FIELDS.filter((f) => f.group === g).map((f) => (
              <label key={f.key} className={`${label} ${f.type === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                <span>
                  {f.label}
                  {overridden.includes(f.key) && <span className="ml-1 text-accent" title="Edited on the website">• edited</span>}
                </span>
                {f.type === "textarea" ? (
                  <textarea name={f.key} defaultValue={val(f.key)} rows={3} className={field} />
                ) : f.type === "select" ? (
                  <select name={f.key} defaultValue={val(f.key)} className={field}>
                    {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === "bool" ? (
                  <select name={f.key} defaultValue={values[f.key] == null ? "" : values[f.key] ? "yes" : "no"} className={field}>
                    <option value="">Unknown</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                ) : (
                  <input
                    name={f.key}
                    type={f.type === "date" ? "date" : f.type === "number" ? "text" : "text"}
                    inputMode={f.type === "number" ? "decimal" : undefined}
                    defaultValue={f.type === "date" ? val(f.key).slice(0, 10) : val(f.key)}
                    className={field}
                  />
                )}
                {f.hint && <span className="block">{f.hint}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="flex items-center gap-3">
        <Submit pending={pending}>Save details</Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

const CONF = (
  <>
    <option value="high">High: registered deal or official</option>
    <option value="medium">Medium: reputable news</option>
    <option value="low">Low: listing / asking price</option>
  </>
);

export function AddPriceForm({ action }: { action: Action }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className={label}><span>Date</span><input name="date" type="date" required className={field} /></label>
      <label className={label}><span>₹ per sq ft</span><input name="price_psf" inputMode="numeric" required className={field} placeholder="e.g. 65000" /></label>
      <label className={label}>
        <span>Stage</span>
        <select name="stage" defaultValue="resale" className={field}>{STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
      </label>
      <label className={label}>
        <span>Area basis</span>
        <select name="basis" defaultValue="carpet" className={field}>
          <option value="carpet">Carpet</option>
          <option value="saleable">Saleable / built-up</option>
          <option value="unknown">Not clear</option>
        </select>
      </label>
      <label className={label}><span>Confidence</span><select name="confidence" defaultValue="medium" className={field}>{CONF}</select></label>
      <label className={`${label} lg:col-span-2`}><span>Source link</span><input name="source_url" type="url" required className={field} placeholder="https://…" /></label>
      <label className={label}><span>Source name (optional)</span><input name="source_name" className={field} /></label>
      <label className={`${label} sm:col-span-2 lg:col-span-4`}><span>Note (optional)</span><input name="note" className={field} placeholder="e.g. ₹12 Cr ÷ 1,850 sq ft carpet, 32nd floor" /></label>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
        <Submit pending={pending}>Add price</Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

export function AddRentForm({ action }: { action: Action }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className={label}><span>Date</span><input name="date" type="date" required className={field} /></label>
      <label className={label}><span>Apartment</span><input name="config" required className={field} placeholder="3 BHK" /></label>
      <label className={label}><span>Carpet area (sq ft)</span><input name="carpet_sqft" inputMode="numeric" className={field} /></label>
      <label className={label}><span>Rent per month (₹)</span><input name="monthly_rent" inputMode="numeric" required className={field} placeholder="e.g. 350000" /></label>
      <label className={label}>
        <span>Furnishing</span>
        <select name="furnishing" defaultValue="unknown" className={field}>
          <option value="unknown">Not stated</option>
          <option value="furnished">Furnished</option>
          <option value="semi_furnished">Semi-furnished</option>
          <option value="unfurnished">Unfurnished</option>
        </select>
      </label>
      <label className={label}>
        <span>Type</span>
        <select name="kind" defaultValue="asking" className={field}>
          <option value="asking">Asking (listing)</option>
          <option value="registered">Registered lease</option>
        </select>
      </label>
      <label className={label}><span>Confidence</span><select name="confidence" defaultValue="low" className={field}>{CONF}</select></label>
      <label className={label}><span>Source link</span><input name="source_url" type="url" required className={field} placeholder="https://…" /></label>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
        <Submit pending={pending}>Add rent</Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

export function AddNewsForm({ action }: { action: Action }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className={`${label} sm:col-span-2`}><span>Article link</span><input name="url" type="url" required className={field} placeholder="https://…" /></label>
      <label className={label}><span>Date</span><input name="date" type="date" className={field} /></label>
      <label className={label}>
        <span>Event</span>
        <select name="event_type" defaultValue="other" className={field}>
          {["launch", "price_hike", "deal", "delay", "litigation", "possession", "rera", "redevelopment", "other"].map((e) => (
            <option key={e} value={e}>{e.replace("_", " ")}</option>
          ))}
        </select>
      </label>
      <label className={`${label} sm:col-span-2 lg:col-span-3`}><span>Headline</span><input name="title" required className={field} /></label>
      <label className={label}><span>Outlet (optional)</span><input name="source" className={field} /></label>
      <label className={`${label} sm:col-span-2 lg:col-span-4`}><span>Summary (optional)</span><input name="summary" className={field} /></label>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
        <Submit pending={pending}>Link news</Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

export function DeleteButton({ action, what }: { action: () => Promise<FormState>; what: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Remove this ${what}?`)) return;
          start(async () => {
            try {
              const r = await action();
              if (r?.error) setError(r.error);
              else router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Couldn't remove it.");
            }
          });
        }}
        className="text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
    </span>
  );
}
