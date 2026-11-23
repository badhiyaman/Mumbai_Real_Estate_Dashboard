# Real Estate Dashboard

An educational dashboard for understanding the Mumbai luxury (₹5 Cr+) property market:

- **Market History** (`/history`): major projects since about 2010, how their prices moved from launch to today, and
  everything else worth knowing about each one: specs, approvals, rents, rental yield and news.
- **Opportunities** (`/opportunities`): upcoming and existing projects scored 0–100 by a transparent, adjustable
  eight-factor model, with likely price ranges over 3, 5 and 7 years compared with a bank FD.
- **News** (`/news`): Mumbai real estate news, collected automatically every day.

Prices come from public sources and are approximate. This is not financial advice.

## Tech

Next.js (TypeScript, Tailwind CSS) · Supabase (Postgres) · Vercel (hosting and the daily news job) · Recharts · Vitest

## Running it locally

1. Install Node.js 24, then run `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the values (see the comments in that file).
3. `npm run dev`, then open http://localhost:3000.

## Setting up a new Supabase database

In Supabase > SQL Editor, run these files in order (each is safe to re-run):

1. `supabase/schema.sql`: the tables
2. `supabase/grants.sql`: lets the API keys use the tables
3. `supabase/rls.sql`: row-level security (anyone can read; only the secret key can write)
4. `supabase/migrations/002_more_fields.sql`: building specs, rents and buying costs

Then load the data with `npm run seed`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Run the app locally |
| `npm test` | Run the tests (growth, yield, scoring, news filtering) |
| `npm run validate` | Check the research files in `data/seed/` for mistakes |
| `npm run merge-research` | Combine developer and area details from `data/seed/_research/` |
| `npm run seed` | Load everything in `data/seed/` into Supabase (safe to re-run) |
| `npm run news` | Fetch and save today's news (`-- --dry-run` to preview, `-- --recheck` to clean up) |

## Adding projects

Follow `data/seed/RESEARCH_GUIDE.md`, add one JSON file per project to `data/seed/projects/`, then run
`npm run validate` and `npm run seed`.

## Deployment

Hosted on Vercel, connected to the GitHub repository. Every push to `main` redeploys. `vercel.json` schedules
`/api/cron/news` daily at 01:30 UTC (7:00 IST). Vercel sends the `CRON_SECRET` automatically. The same environment
variables as `.env.local` must be set in Vercel > Project > Settings > Environment Variables.
