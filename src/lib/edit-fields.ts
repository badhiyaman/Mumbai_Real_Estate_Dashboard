// Project fields that can be edited on the website, with how to show and check each one.
// Shared by the edit form (rendering) and the server action (parsing and validation).

export type FieldType = "text" | "textarea" | "number" | "date" | "select" | "bool";

export interface EditField {
  key: string;
  label: string;
  type: FieldType;
  group: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  integer?: boolean;
  hint?: string;
}

export const PROJECT_FIELDS: EditField[] = [
  { key: "name", label: "Name", type: "text", group: "Basics" },
  {
    key: "status", label: "Status", type: "select", group: "Basics",
    options: [
      { value: "completed", label: "Completed" },
      { value: "under_construction", label: "Under construction" },
      { value: "upcoming", label: "Upcoming" },
    ],
  },
  { key: "address", label: "Address", type: "text", group: "Basics" },
  { key: "description", label: "Description", type: "textarea", group: "Basics" },
  { key: "notes", label: "Things to know", type: "textarea", group: "Basics", hint: "Delays, litigation, notable buyers…" },
  { key: "image_url", label: "Image URL", type: "text", group: "Basics" },

  { key: "launch_date", label: "Launched", type: "date", group: "Dates" },
  { key: "possession_promised", label: "Possession promised", type: "date", group: "Dates" },
  { key: "possession_actual", label: "Possession actual", type: "date", group: "Dates" },
  { key: "oc_received", label: "Occupation certificate received", type: "bool", group: "Dates" },
  { key: "oc_date", label: "OC date", type: "date", group: "Dates" },

  { key: "land_acres", label: "Land parcel (acres)", type: "number", group: "Building", min: 0, max: 500 },
  { key: "towers", label: "Towers", type: "number", group: "Building", min: 0, max: 50, integer: true },
  { key: "floors_max", label: "Tallest tower (floors)", type: "number", group: "Building", min: 0, max: 150, integer: true },
  { key: "total_units", label: "Total units", type: "number", group: "Building", min: 0, max: 20000, integer: true },
  { key: "flats_per_floor", label: "Flats per floor", type: "number", group: "Building", min: 0, max: 50, integer: true },
  { key: "lifts_per_tower", label: "Lifts per tower", type: "number", group: "Building", min: 0, max: 50, integer: true },
  { key: "ceiling_height_ft", label: "Ceiling height (ft)", type: "number", group: "Building", min: 7, max: 30 },
  { key: "car_parks_per_unit", label: "Car parks per unit", type: "number", group: "Building", min: 0, max: 20 },
  { key: "architect", label: "Architect", type: "text", group: "Building" },
  { key: "contractor", label: "Contractor", type: "text", group: "Building" },

  { key: "units_sold", label: "Units sold", type: "number", group: "Sales & pricing", min: 0, max: 20000, integer: true },
  { key: "units_sold_as_of", label: "Units sold, as of", type: "date", group: "Sales & pricing" },
  { key: "transactions_12m", label: "Registered sales, last 12 months", type: "number", group: "Sales & pricing", min: 0, max: 5000, integer: true },
  { key: "loading_pct", label: "Loading %", type: "number", group: "Sales & pricing", min: 0, max: 80, hint: "How much bigger saleable area is than carpet" },
  { key: "floor_rise_psf", label: "Floor rise (₹/sq ft per floor)", type: "number", group: "Sales & pricing", min: 0, max: 10000 },
  { key: "maintenance_psf_month", label: "Maintenance (₹/sq ft/month)", type: "number", group: "Sales & pricing", min: 0, max: 500 },
  { key: "payment_plan", label: "Payment plan", type: "text", group: "Sales & pricing" },
  { key: "rera_complaints", label: "MahaRERA complaints", type: "number", group: "Sales & pricing", min: 0, max: 5000, integer: true },
];

export const STAGES = [
  { value: "pre_launch", label: "Pre-launch" },
  { value: "launch", label: "Launch" },
  { value: "under_construction", label: "Under construction" },
  { value: "completion", label: "Completion" },
  { value: "resale", label: "Resale" },
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Turns one form value into a database value, or explains what's wrong. Empty means "clear it". */
export function parseField(f: EditField, raw: FormDataEntryValue | null): ParseResult<string | number | boolean | null> {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (f.type === "bool") return { ok: true, value: s === "yes" ? true : s === "no" ? false : null };
  if (s === "") {
    if (f.key === "name" || f.key === "status") return { ok: false, error: `${f.label} can't be empty.` };
    return { ok: true, value: null };
  }
  switch (f.type) {
    case "number": {
      const n = Number(s.replace(/,/g, ""));
      if (!Number.isFinite(n)) return { ok: false, error: `${f.label} must be a number.` };
      if (f.integer && !Number.isInteger(n)) return { ok: false, error: `${f.label} must be a whole number.` };
      if ((f.min != null && n < f.min) || (f.max != null && n > f.max))
        return { ok: false, error: `${f.label} should be between ${f.min} and ${f.max}.` };
      return { ok: true, value: n };
    }
    case "date":
      return DATE.test(s) ? { ok: true, value: s } : { ok: false, error: `${f.label} must be a date.` };
    case "select":
      return f.options?.some((o) => o.value === s) ? { ok: true, value: s } : { ok: false, error: `Pick a valid ${f.label.toLowerCase()}.` };
    default:
      if (f.key === "image_url" && !/^https?:\/\/\S+$/.test(s)) return { ok: false, error: "Image URL must start with http(s)://" };
      return { ok: true, value: s.slice(0, f.type === "textarea" ? 5000 : 300) };
  }
}

export const isUrl = (s: string) => /^https?:\/\/\S+$/.test(s);
export const isDate = (s: string) => DATE.test(s);

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
