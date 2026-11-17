import Link from "next/link";

const sections = [
  {
    href: "/history",
    title: "Market History",
    body: "Major Mumbai projects since about 2010 above ₹5 Cr. See how prices moved from pre-launch to today, with each project's news.",
  },
  {
    href: "/opportunities",
    title: "Opportunities",
    body: "Upcoming and existing projects with a transparent, adjustable score for how likely prices are to rise, and over what time.",
  },
  {
    href: "/news",
    title: "News",
    body: "Mumbai real estate news, collected automatically every day.",
  },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Mumbai Real Estate Dashboard</h1>
        <p className="max-w-2xl text-muted">
          Learn how the Mumbai luxury market has behaved over the last 15 years before you invest.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-lg border border-border bg-surface p-5 transition hover:border-accent"
          >
            <h2 className="font-medium">{s.title}</h2>
            <p className="mt-2 text-sm text-muted">{s.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
