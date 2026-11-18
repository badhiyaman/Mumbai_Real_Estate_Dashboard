-- Adds building specs, land & approvals, pricing details, location, rents, and buying costs.
-- Paste into Supabase > SQL Editor (New query) and click Run. Safe to re-run.

alter table developers add column if not exists listed_ticker text;

alter table micro_markets add column if not exists typical_rent_yield_pct numeric;
alter table micro_markets add column if not exists rent_yield_source_url text;

alter table unit_types add column if not exists units int;

alter table projects
  add column if not exists architect text,
  add column if not exists contractor text,
  add column if not exists branded_residence text,
  add column if not exists flats_per_floor int,
  add column if not exists lifts_per_tower int,
  add column if not exists ceiling_height_ft numeric,
  add column if not exists car_parks_per_unit numeric,
  add column if not exists clubhouse_sqft int,
  add column if not exists open_space_pct numeric,
  add column if not exists green_certification text,
  add column if not exists views text[] not null default '{}',
  add column if not exists land_type text,
  add column if not exists land_tenure text,
  add column if not exists jv_partner text,
  add column if not exists oc_received boolean,
  add column if not exists oc_date date,
  add column if not exists rera_complaints int,
  add column if not exists units_sold int,
  add column if not exists units_sold_as_of date,
  add column if not exists loading_pct numeric,
  add column if not exists floor_rise_psf numeric,
  add column if not exists floor_rise_notes text,
  add column if not exists maintenance_psf_month numeric,
  add column if not exists payment_plan text,
  add column if not exists transactions_12m int,
  add column if not exists nearest_metro text,
  add column if not exists nearest_metro_km numeric,
  add column if not exists distance_bkc_km numeric,
  add column if not exists distance_airport_km numeric;

create table if not exists rental_points (
  id           bigint generated always as identity primary key,
  project_id   bigint not null references projects(id) on delete cascade,
  date         date not null,
  config       text not null,
  carpet_sqft  int,
  monthly_rent numeric not null,
  furnishing   text not null default 'unknown' check (furnishing in ('furnished','semi_furnished','unfurnished','unknown')),
  kind         text not null default 'asking' check (kind in ('asking','registered')),
  source_name  text,
  source_url   text,
  confidence   text not null check (confidence in ('high','medium','low')),
  note         text
);
create index if not exists rental_points_project_idx on rental_points(project_id, date);

create table if not exists cost_items (
  key         text primary key,
  name        text not null,
  stage       text not null check (stage in ('buying','holding','renting','selling')),
  value       text not null,
  rate_pct    numeric,
  applies_to  text,
  as_of       date not null,
  source_name text,
  source_url  text,
  note        text
);

-- Access: anyone can read, only the server (secret key) can write.
grant select on rental_points, cost_items to anon, authenticated;
grant all on rental_points, cost_items to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table rental_points enable row level security;
alter table cost_items enable row level security;
drop policy if exists "public read" on rental_points;
create policy "public read" on rental_points for select using (true);
drop policy if exists "public read" on cost_items;
create policy "public read" on cost_items for select using (true);

notify pgrst, 'reload schema';

-- Check: should list both new tables with rls_on = true, and 29 new project columns.
select 'rental_points' as item, (select relrowsecurity from pg_class where relname = 'rental_points')::text as rls_on
union all
select 'cost_items', (select relrowsecurity from pg_class where relname = 'cost_items')::text
union all
select 'new project columns', count(*)::text from information_schema.columns
where table_schema = 'public' and table_name = 'projects' and column_name in (
  'architect','contractor','branded_residence','flats_per_floor','lifts_per_tower','ceiling_height_ft',
  'car_parks_per_unit','clubhouse_sqft','open_space_pct','green_certification','views','land_type','land_tenure',
  'jv_partner','oc_received','oc_date','rera_complaints','units_sold','units_sold_as_of','loading_pct',
  'floor_rise_psf','floor_rise_notes','maintenance_psf_month','payment_plan','transactions_12m','nearest_metro',
  'nearest_metro_km','distance_bkc_km','distance_airport_km');
