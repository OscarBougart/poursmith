-- PourSmith Epic 1 schema. Run once in the Supabase SQL editor.

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  category text not null check (category in ('spirit','liqueur','juice','syrup','produce','other')),
  pack_size numeric not null check (pack_size > 0),
  unit text not null check (unit in ('ml','g','piece')),
  price_gross numeric not null check (price_gross >= 0),
  vat_rate numeric not null default 0.19 check (vat_rate in (0, 0.07, 0.19)),
  price_net numeric generated always as (round(price_gross / (1 + vat_rate), 4)) stored,
  waste_pct numeric not null default 0 check (waste_pct >= 0 and waste_pct < 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ingredients_user_name_key on public.ingredients (user_id, lower(name));

create table public.preps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  yield_amount numeric not null check (yield_amount > 0),
  yield_unit text not null check (yield_unit in ('ml','g','piece')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index preps_user_name_key on public.preps (user_id, lower(name));

create table public.prep_lines (
  id uuid primary key default gen_random_uuid(),
  prep_id uuid not null references public.preps (id) on delete cascade,
  ingredient_id uuid references public.ingredients (id) on delete restrict,
  component_prep_id uuid references public.preps (id) on delete restrict,
  amount numeric not null check (amount > 0),
  check (num_nonnulls(ingredient_id, component_prep_id) = 1),
  check (component_prep_id is null or component_prep_id <> prep_id)
);
create index prep_lines_prep_id_idx on public.prep_lines (prep_id);

-- keep updated_at honest
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger ingredients_updated_at before update on public.ingredients
  for each row execute function public.set_updated_at();
create trigger preps_updated_at before update on public.preps
  for each row execute function public.set_updated_at();

-- reject circular prep references (defense in depth; the UI checks first)
create or replace function public.check_prep_cycle()
returns trigger language plpgsql as $$
begin
  if new.component_prep_id is null then
    return new;
  end if;
  if exists (
    with recursive deps as (
      select new.component_prep_id as pid
      union
      select pl.component_prep_id
      from public.prep_lines pl
      join deps d on pl.prep_id = d.pid
      where pl.component_prep_id is not null
    )
    select 1 from deps where pid = new.prep_id
  ) then
    raise exception 'circular prep reference';
  end if;
  return new;
end $$;

create trigger prep_lines_cycle_check before insert or update on public.prep_lines
  for each row execute function public.check_prep_cycle();

-- RLS: single owner, everything keyed to auth.uid()
alter table public.ingredients enable row level security;
alter table public.preps enable row level security;
alter table public.prep_lines enable row level security;

create policy "own ingredients" on public.ingredients
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own preps" on public.preps
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own prep lines" on public.prep_lines
  for all
  using (exists (select 1 from public.preps p where p.id = prep_id and p.user_id = auth.uid()))
  with check (
    exists (select 1 from public.preps p where p.id = prep_id and p.user_id = auth.uid())
    and (ingredient_id is null or exists (
      select 1 from public.ingredients i where i.id = ingredient_id and i.user_id = auth.uid()))
    and (component_prep_id is null or exists (
      select 1 from public.preps cp where cp.id = component_prep_id and cp.user_id = auth.uid()))
  );
