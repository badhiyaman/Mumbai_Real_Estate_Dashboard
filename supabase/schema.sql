-- Mumbai Real Estate Dashboard: database schema.
-- Paste into Supabase > SQL Editor and click Run. Safe to re-run.

create table if not exists developers (
  id            bigint generated always as identity primary key,
  slug          text unique not null,
  name          text not null,
  founded_year  int,
  projects_delivered int,
  delivery_track_record text,        -- plain-English summary of on-time delivery
  on_time_score int check (on_time_score between 0 and 100),
  website       text,
  notes         text
);

create table if not exists micro_markets (
  id        bigint generated always as identity primary key,
  slug      text unique not null,
  name      text not null,
  region    text,                     -- e.g. South Mumbai, Central Mumbai, Western Suburbs
  lat       double precision,
  lng       double precision,
  -- [{ name, type, status, expected_year, source_url }]
  catalysts jsonb not null default '[]'::jsonb,
  notes     text
);

create table if not exists projects (
  id                  bigint generated always as identity primary key,
  slug                text unique not null,
  name                text not null,
  developer_id        bigint references developers(id),
  micro_market_id     bigint references micro_markets(id),
  address             text,
  lat                 double precision,
  lng                 double precision,
  land_acres          numeric,
  towers              int,
  floors_max          int,
  total_units         int,
  rera_ids            text[] not null default '{}',
  status              text not null check (status in ('completed','under_construction','upcoming')),
  launch_date         date,
  possession_promised date,
  possession_actual   date,
  amenities           text[] not null default '{}',
  description         text,
  image_url           text,
  notes               text,           -- litigation, delays, redevelopment, notable buyers
  sources             text[] not null default '{}',
  updated_at          timestamptz not null default now()
);

create table if not exists unit_types (
  id              bigint generated always as identity primary key,
  project_id      bigint not null references projects(id) on delete cascade,
  config          text not null,      -- e.g. "3 BHK", "4 BHK", "Penthouse"
  carpet_sqft_min int,
  carpet_sqft_max int,
  price_min_cr    numeric,            -- ticket size at the latest known price
  price_max_cr    numeric,
  notes           text
);

create table if not exists price_points (
  id          bigint generated always as identity primary key,
  project_id  bigint not null references projects(id) on delete cascade,
  date        date not null,
  date_precision text not null default 'month' check (date_precision in ('day','month','year')),
  stage       text not null check (stage in ('pre_launch','launch','under_construction','completion','resale')),
  price_psf   numeric not null,       -- rupees per sq ft
  basis       text not null default 'carpet' check (basis in ('carpet','saleable','unknown')),
  source_name text,
  source_url  text,
  confidence  text not null check (confidence in ('high','medium','low')),
  note        text
);

create table if not exists news_articles (
  id           bigint generated always as identity primary key,
  url          text unique not null,
  title        text not null,
  source       text,
  published_at timestamptz,
  snippet      text,
  topics       text[] not null default '{}',   -- e.g. policy, infra, launch, deal, rbi
  micro_market_slugs text[] not null default '{}',
  developer_slugs    text[] not null default '{}',
  created_at   timestamptz not null default now()
);

create table if not exists project_news (
  project_id bigint not null references projects(id) on delete cascade,
  article_id bigint not null references news_articles(id) on delete cascade,
  event_type text,                    -- launch, price_hike, deal, delay, litigation, possession, rera, redevelopment, other
  origin     text not null default 'auto' check (origin in ('research','auto')),
  primary key (project_id, article_id)
);

create index if not exists price_points_project_idx on price_points(project_id, date);
create index if not exists news_published_idx on news_articles(published_at desc);

-- Newer Supabase projects don't grant table access to the API roles automatically.
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Anyone can read; only the server (service role key) can write.
do $$
declare t text;
begin
  foreach t in array array['developers','micro_markets','projects','unit_types','price_points','news_articles','project_news']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;
end $$;
