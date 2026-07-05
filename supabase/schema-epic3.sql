-- PourSmith Epic 3 schema. Run once in the Supabase SQL editor (after Epic 1 & 2).

alter table public.recipes add column description_de text;
alter table public.recipes add column description_en text;

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index menus_user_name_key on public.menus (user_id, lower(name));
create trigger menus_updated_at before update on public.menus
  for each row execute function public.set_updated_at();
alter table public.menus enable row level security;
create policy "own menus" on public.menus
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete restrict,
  sort_order integer not null default 0
);
create index menu_items_menu_id_idx on public.menu_items (menu_id);
create unique index menu_items_menu_recipe_key on public.menu_items (menu_id, recipe_id);
alter table public.menu_items enable row level security;
create policy "own menu items" on public.menu_items
  for all
  using (exists (select 1 from public.menus m where m.id = menu_id and m.user_id = auth.uid()))
  with check (
    exists (select 1 from public.menus m where m.id = menu_id and m.user_id = auth.uid())
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
