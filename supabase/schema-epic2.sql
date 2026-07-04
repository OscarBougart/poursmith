-- PourSmith Epic 2 schema. Run once in the Supabase SQL editor (after Epic 1's schema.sql).

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  target_cost_pct numeric not null default 20 check (target_cost_pct > 0 and target_cost_pct < 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();
alter table public.settings enable row level security;
create policy "own settings" on public.settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  glass text,
  ice text,
  method text not null default 'shaken' check (method in ('shaken','stirred','built','thrown')),
  price_gross numeric check (price_gross >= 0),
  target_cost_pct_override numeric check (target_cost_pct_override > 0 and target_cost_pct_override < 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index recipes_user_name_key on public.recipes (user_id, lower(name));
create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();
alter table public.recipes enable row level security;
create policy "own recipes" on public.recipes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.recipe_lines (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  ingredient_id uuid references public.ingredients (id) on delete restrict,
  component_prep_id uuid references public.preps (id) on delete restrict,
  amount numeric not null check (amount > 0),
  unit text not null check (unit in ('ml','cl','oz','dash','barspoon','g','piece')),
  is_garnish boolean not null default false,
  check (num_nonnulls(ingredient_id, component_prep_id) = 1)
);
create index recipe_lines_recipe_id_idx on public.recipe_lines (recipe_id);
alter table public.recipe_lines enable row level security;
create policy "own recipe lines" on public.recipe_lines
  for all
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()))
  with check (
    exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
    and (ingredient_id is null or exists (
      select 1 from public.ingredients i where i.id = ingredient_id and i.user_id = auth.uid()))
    and (component_prep_id is null or exists (
      select 1 from public.preps p where p.id = component_prep_id and p.user_id = auth.uid()))
  );
