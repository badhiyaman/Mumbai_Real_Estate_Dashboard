-- Turns on row-level security: anyone can read, only the server (secret key) can write.
-- Safe to re-run. Then shows each table's status.
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

select c.relname as table_name,
       c.relrowsecurity as rls_on,
       count(p.policyname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
where c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by c.relname;
