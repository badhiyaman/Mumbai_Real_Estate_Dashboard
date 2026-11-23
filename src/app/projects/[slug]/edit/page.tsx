import Link from "next/link";
import { notFound } from "next/navigation";
import { AddNewsForm, AddPriceForm, AddRentForm, DeleteButton, ProjectDetailsForm } from "@/components/EditForms";
import SignInForm from "@/components/SignInForm";
import { isAdmin } from "@/lib/auth";
import { fmtDate, fmtPsf, sortedPrices, STAGE_LABEL } from "@/lib/metrics";
import { getProject } from "@/lib/queries";
import { addNewsLink, addPricePoint, addRentalPoint, deleteRow, updateProject } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function EditProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await isAdmin())) return <SignInForm next={`/projects/${slug}/edit`} />;
  const project = await getProject(slug);
  if (!project) notFound();
  const p = project as typeof project & { manual_overrides?: Record<string, unknown>; created_in_app?: boolean };
  type Row = { id: number; source?: string };
  const prices = sortedPrices(project.price_points).reverse() as (typeof project.price_points[number] & Row)[];
  const rents = [...project.rental_points].sort((a, b) => b.date.localeCompare(a.date)) as (typeof project.rental_points[number] & Row)[];
  const overridden = Object.keys(p.manual_overrides ?? {});

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <div className="flex gap-4 text-sm text-muted">
          <Link href={`/projects/${slug}`} className="hover:text-foreground">← Back to project</Link>
          <Link href="/admin" className="hover:text-foreground">Admin</Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit {project.name}</h1>
        <p className="max-w-3xl text-sm text-muted">
          Changes go live within a minute. Edited fields (marked &ldquo;• edited&rdquo;) and anything you add here are kept
          when the research files are reloaded with <code>npm run seed</code>.
          {!p.created_in_app && " Rows marked “from files” come back on the next reload if you remove them here, so fix those in data/seed/ instead."}
        </p>
      </header>

      <Section title="Project details">
        <ProjectDetailsForm values={project as unknown as Record<string, unknown>} action={updateProject.bind(null, slug)} overridden={overridden} />
      </Section>

      <Section title={`Prices (${prices.length})`}>
        <AddPriceForm action={addPricePoint.bind(null, slug)} />
        <RowTable
          headers={["Date", "Stage", "Price", "Basis", "Confidence", ""]}
          rows={prices.map((r) => ({
            id: r.id,
            fromFiles: r.source !== "app",
            cells: [fmtDate(r.date, r.date_precision), STAGE_LABEL[r.stage], fmtPsf(r.price_psf), r.basis, r.confidence],
            remove: deleteRow.bind(null, slug, "price_points", r.id),
          }))}
          what="price"
        />
      </Section>

      <Section title={`Rents (${rents.length})`}>
        <AddRentForm action={addRentalPoint.bind(null, slug)} />
        <RowTable
          headers={["Date", "Apartment", "Rent / month", "Type", "Confidence", ""]}
          rows={rents.map((r) => ({
            id: r.id,
            fromFiles: r.source !== "app",
            cells: [
              fmtDate(r.date),
              `${r.config}${r.carpet_sqft ? `, ${r.carpet_sqft.toLocaleString("en-IN")} sq ft` : ""}`,
              `₹${r.monthly_rent.toLocaleString("en-IN")}`,
              r.kind,
              r.confidence,
            ],
            remove: deleteRow.bind(null, slug, "rental_points", r.id),
          }))}
          what="rent"
        />
      </Section>

      <Section title="Link a news article">
        <AddNewsForm action={addNewsLink.bind(null, slug)} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-lg font-medium">{title}</h2>
      {children}
    </section>
  );
}

function RowTable({
  headers,
  rows,
  what,
}: {
  headers: string[];
  rows: { id: number; fromFiles: boolean; cells: string[]; remove: () => Promise<{ ok?: string; error?: string } | null> }[];
  what: string;
}) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="text-xs text-muted">
          <tr className="border-b border-border">{headers.map((h) => <th key={h} className="py-1.5 pr-3 font-normal">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border">
              {r.cells.map((c, i) => <td key={i} className="py-1.5 pr-3">{c}</td>)}
              <td className="py-1.5 text-right whitespace-nowrap">
                <span className="mr-3 text-xs text-muted">{r.fromFiles ? "from files" : "added here"}</span>
                <DeleteButton action={r.remove} what={what} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
