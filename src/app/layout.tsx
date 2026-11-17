import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mumbai Real Estate Dashboard",
  description:
    "Price history of major Mumbai projects, investment scoring, and daily real estate news.",
};

const navLinks = [
  { href: "/history", label: "Market History" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/news", label: "News" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <header className="border-b border-border bg-surface">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              Mumbai RE Dashboard
            </Link>
            <ul className="flex flex-wrap gap-4 text-sm text-muted">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted">
          For education only. This is not financial advice. Prices are approximate and come from
          public sources.
        </footer>
      </body>
    </html>
  );
}
