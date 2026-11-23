-- Lets edits made on the website survive `npm run seed`.
-- Paste into Supabase > SQL Editor (New query) and click Run. Safe to re-run.

-- Where a price or rent row came from: 'seed' (data/seed files) or 'app' (added on the website).
-- The seed script only replaces 'seed' rows.
alter table price_points add column if not exists source text not null default 'seed';
alter table rental_points add column if not exists source text not null default 'seed';

-- Project fields changed on the website. The seed script re-applies these after loading the files,
-- so a website edit wins over the files until it's copied into them.
alter table projects add column if not exists manual_overrides jsonb not null default '{}'::jsonb;

-- Projects created on the website (not in data/seed/projects).
alter table projects add column if not exists created_in_app boolean not null default false;

-- News linked to a project by hand on the website.
alter table project_news drop constraint if exists project_news_origin_check;
alter table project_news add constraint project_news_origin_check check (origin in ('research', 'auto', 'manual'));

notify pgrst, 'reload schema';

-- Check: should show 4 rows.
select table_name, column_name from information_schema.columns
where table_schema = 'public'
  and ((table_name in ('price_points', 'rental_points') and column_name = 'source')
    or (table_name = 'projects' and column_name in ('manual_overrides', 'created_in_app')))
order by table_name, column_name;
