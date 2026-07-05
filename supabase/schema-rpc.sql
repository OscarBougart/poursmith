-- PourSmith transactional write functions. Run once in the Supabase SQL editor
-- (after schema.sql, schema-epic2.sql, schema-epic3.sql).
--
-- Each function runs in a single transaction: any error inside it rolls back
-- every statement, so a prep/recipe can never be left half-written. All run
-- SECURITY INVOKER, so the existing row-level security policies still apply.

-- Insert or replace a prep together with its component lines.
create or replace function public.save_prep(
  p_id uuid,
  p_name text,
  p_yield_amount numeric,
  p_yield_unit text,
  p_notes text,
  p_lines jsonb
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid := p_id;
begin
  if v_id is null then
    insert into public.preps (name, yield_amount, yield_unit, notes)
    values (p_name, p_yield_amount, p_yield_unit, p_notes)
    returning id into v_id;
  else
    update public.preps
       set name = p_name,
           yield_amount = p_yield_amount,
           yield_unit = p_yield_unit,
           notes = p_notes
     where id = v_id;
    if not found then
      raise exception 'Prep not found' using errcode = 'no_data_found';
    end if;
    delete from public.prep_lines where prep_id = v_id;
  end if;

  insert into public.prep_lines (prep_id, ingredient_id, component_prep_id, amount)
  select v_id,
         nullif(line->>'ingredient_id', '')::uuid,
         nullif(line->>'component_prep_id', '')::uuid,
         (line->>'amount')::numeric
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) as line;

  return v_id;
end;
$$;

-- Insert or replace a recipe together with its lines.
create or replace function public.save_recipe(
  p_id uuid,
  p_name text,
  p_glass text,
  p_ice text,
  p_method text,
  p_price_gross numeric,
  p_target_cost_pct_override numeric,
  p_notes text,
  p_description_de text,
  p_description_en text,
  p_lines jsonb
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid := p_id;
begin
  if v_id is null then
    insert into public.recipes
      (name, glass, ice, method, price_gross, target_cost_pct_override,
       notes, description_de, description_en)
    values
      (p_name, p_glass, p_ice, p_method, p_price_gross, p_target_cost_pct_override,
       p_notes, p_description_de, p_description_en)
    returning id into v_id;
  else
    update public.recipes
       set name = p_name,
           glass = p_glass,
           ice = p_ice,
           method = p_method,
           price_gross = p_price_gross,
           target_cost_pct_override = p_target_cost_pct_override,
           notes = p_notes,
           description_de = p_description_de,
           description_en = p_description_en
     where id = v_id;
    if not found then
      raise exception 'Recipe not found' using errcode = 'no_data_found';
    end if;
    delete from public.recipe_lines where recipe_id = v_id;
  end if;

  insert into public.recipe_lines
    (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish)
  select v_id,
         nullif(line->>'ingredient_id', '')::uuid,
         nullif(line->>'component_prep_id', '')::uuid,
         (line->>'amount')::numeric,
         line->>'unit',
         coalesce((line->>'is_garnish')::boolean, false)
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) as line;

  return v_id;
end;
$$;

-- Copy a recipe and its lines under a new name.
create or replace function public.duplicate_recipe(
  p_source uuid,
  p_new_name text
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid;
begin
  insert into public.recipes
    (name, glass, ice, method, price_gross, target_cost_pct_override,
     notes, description_de, description_en)
  select p_new_name, glass, ice, method, price_gross, target_cost_pct_override,
         notes, description_de, description_en
    from public.recipes
   where id = p_source
  returning id into v_id;

  if v_id is null then
    raise exception 'Source recipe not found' using errcode = 'no_data_found';
  end if;

  insert into public.recipe_lines
    (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish)
  select v_id, ingredient_id, component_prep_id, amount, unit, is_garnish
    from public.recipe_lines
   where recipe_id = p_source;

  return v_id;
end;
$$;

-- Swap a menu item with its neighbour in one transaction.
create or replace function public.reorder_menu_item(
  p_id uuid,
  p_direction text
) returns void
language plpgsql
security invoker
as $$
declare
  v_menu uuid;
  v_order integer;
  v_neighbour_id uuid;
  v_neighbour_order integer;
begin
  select menu_id, sort_order into v_menu, v_order
    from public.menu_items where id = p_id;
  if v_menu is null then
    raise exception 'Menu item not found' using errcode = 'no_data_found';
  end if;

  if p_direction = 'up' then
    select id, sort_order into v_neighbour_id, v_neighbour_order
      from public.menu_items
     where menu_id = v_menu and sort_order < v_order
     order by sort_order desc
     limit 1;
  else
    select id, sort_order into v_neighbour_id, v_neighbour_order
      from public.menu_items
     where menu_id = v_menu and sort_order > v_order
     order by sort_order asc
     limit 1;
  end if;

  if v_neighbour_id is null then
    return; -- already at an edge
  end if;

  update public.menu_items set sort_order = v_neighbour_order where id = p_id;
  update public.menu_items set sort_order = v_order where id = v_neighbour_id;
end;
$$;

grant execute on function
  public.save_prep(uuid, text, numeric, text, text, jsonb),
  public.save_recipe(uuid, text, text, text, text, numeric, numeric, text, text, text, jsonb),
  public.duplicate_recipe(uuid, text),
  public.reorder_menu_item(uuid, text)
to authenticated;
