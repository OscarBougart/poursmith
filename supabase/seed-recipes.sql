-- PourSmith recipe demo seed — 10 classic cocktails.
-- Run AFTER schema.sql, seed.sql, schema-epic2.sql (and optionally schema-epic3.sql).
-- Idempotent: re-running adds nothing that already exists (matched by name).
do $$
declare
  owner uuid;
  r uuid;
begin
  select id into owner from auth.users order by created_at limit 1;
  if owner is null then
    raise exception 'No user found — create the owner account first.';
  end if;

  -- Ingredients the classics need beyond the base library (safe to re-run).
  insert into public.ingredients
    (user_id, name, category, pack_size, unit, price_gross, vat_rate, waste_pct)
  values
    (owner, 'Martini Rosso (Wermut)', 'other', 1000, 'ml', 8.99, 0.19, 0),
    (owner, 'Angostura Bitters',      'other',  200, 'ml', 12.99, 0.19, 0),
    (owner, 'Sekt Brut',             'other',  750, 'ml', 7.99, 0.19, 0)
  on conflict (user_id, lower(name)) do nothing;

  -- 1. Negroni
  r := null;
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Negroni', 'Tumbler', 'Großer Würfel', 'stirred', 12.0, null,
      'Gin, Campari und roter Wermut — bittersüßer Klassiker.',
      'Gin, Campari and sweet vermouth — the bittersweet classic.')
    on conflict (user_id, lower(name)) do nothing returning id into r;
  if r is not null then
    insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
      (r, (select id from public.ingredients where user_id = owner and name = 'Tanqueray London Dry Gin'), null, 30, 'ml', false),
      (r, (select id from public.ingredients where user_id = owner and name = 'Campari'), null, 30, 'ml', false),
      (r, (select id from public.ingredients where user_id = owner and name = 'Martini Rosso (Wermut)'), null, 30, 'ml', false);
  end if;

  -- 2. Old Fashioned
  r := null;
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Old Fashioned', 'Tumbler', 'Großer Würfel', 'stirred', 12.0, null,
      'Bourbon, ein Hauch Zucker und Angostura.',
      'Bourbon, a touch of sugar and Angostura bitters.')
    on conflict (user_id, lower(name)) do nothing returning id into r;
  if r is not null then
    insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
      (r, (select id from public.ingredients where user_id = owner and name = 'Bulleit Bourbon'), null, 50, 'ml', false),
      (r, null, (select id from public.preps where user_id = owner and name = 'Simple Syrup 1:1'), 10, 'ml', false),
      (r, (select id from public.ingredients where user_id = owner and name = 'Angostura Bitters'), null, 2, 'dash', false);
  end if;

  -- 3. French 75
  r := null;
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'French 75', 'Flöte', 'Ohne', 'shaken', 13.0, null,
      'Gin und Zitrone, mit Sekt aufgegossen.',
      'Gin and lemon, topped with sparkling wine.')
    on conflict (user_id, lower(name)) do nothing returning id into r;
  if r is not null then
    insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
      (r, (select id from public.ingredients where user_id = owner and name = 'Tanqueray London Dry Gin'), null, 30, 'ml', false),
      (r, null, (select id from public.preps where user_id = owner and name = 'Fresh Lemon Juice'), 15, 'ml', false),
      (r, null, (select id from public.preps where user_id = owner and name = 'Simple Syrup 1:1'), 15, 'ml', false),
      (r, (select id from public.ingredients where user_id = owner and name = 'Sekt Brut'), null, 60, 'ml', false);
  end if;

  -- 4. Martini
  r := null;
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Martini', 'Nick & Nora', 'Ohne', 'stirred', 13.0, null,
      'Gin und trockener Wermut, eiskalt gerührt.',
      'Gin and dry vermouth, stirred ice-cold.')
    on conflict (user_id, lower(name)) do nothing returning id into r;
  if r is not null then
    insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
      (r, (select id from public.ingredients where user_id = owner and name = 'Monkey 47 Dry Gin'), null, 60, 'ml', false),
      (r, (select id from public.ingredients where user_id = owner and name = 'Noilly Prat Dry'), null, 10, 'ml', false);
  end if;

  -- 5. Daiquiri
  r := null;
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Daiquiri', 'Coupe', 'Ohne', 'shaken', 11.0, null,
      'Weißer Rum, Limette, Zucker — perfekt balanciert.',
      'White rum, lime and sugar — perfectly balanced.')
    on conflict (user_id, lower(name)) do nothing returning id into r;
  if r is not null then
    insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
      (r, (select id from public.ingredients where user_id = owner and name = 'Havana Club 3 Años'), null, 60, 'ml', false),
      (r, null, (select id from public.preps where user_id = owner and name = 'Fresh Lime Juice'), 25, 'ml', false),
      (r, null, (select id from public.preps where user_id = owner and name = 'Simple Syrup 1:1'), 15, 'ml', false);
  end if;

  -- 6. Mojito
  r := null;
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Mojito', 'Highball', 'Crushed', 'built', 11.0, null,
      'Rum, Limette, Minze und Soda — spritzig und frisch.',
      'Rum, lime, mint and soda — long and refreshing.')
    on conflict (user_id, lower(name)) do nothing returning id into r;
  if r is not null then
    insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
      (r, (select id from public.ingredients where user_id = owner and name = 'Havana Club 3 Años'), null, 50, 'ml', false),
      (r, null, (select id from public.preps where user_id = owner and name = 'Fresh Lime Juice'), 25, 'ml', false),
      (r, null, (select id from public.preps where user_id = owner and name = 'Simple Syrup 1:1'), 20, 'ml', false),
      (r, (select id from public.ingredients where user_id = owner and name = 'Minze (Bund)'), null, 0.2, 'piece', false),
      (r, (select id from public.ingredients where user_id = owner and name = 'Sodawasser'), null, 60, 'ml', false);
  end if;

  -- 7. Manhattan
  r := null;
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Manhattan', 'Coupe', 'Ohne', 'stirred', 13.0, null,
      'Bourbon, roter Wermut und Angostura.',
      'Bourbon, sweet vermouth and Angostura.')
    on conflict (user_id, lower(name)) do nothing returning id into r;
  if r is not null then
    insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
      (r, (select id from public.ingredients where user_id = owner and name = 'Bulleit Bourbon'), null, 50, 'ml', false),
      (r, (select id from public.ingredients where user_id = owner and name = 'Martini Rosso (Wermut)'), null, 20, 'ml', false),
      (r, (select id from public.ingredients where user_id = owner and name = 'Angostura Bitters'), null, 2, 'dash', false);
  end if;

  -- 8. Margarita
  r := null;
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Margarita', 'Coupe', 'Würfel', 'shaken', 12.0, null,
      'Tequila, Cointreau und Limette.',
      'Tequila, Cointreau and lime.')
    on conflict (user_id, lower(name)) do nothing returning id into r;
  if r is not null then
    insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
      (r, (select id from public.ingredients where user_id = owner and name = 'Olmeca Blanco Tequila'), null, 50, 'ml', false),
      (r, (select id from public.ingredients where user_id = owner and name = 'Cointreau'), null, 20, 'ml', false),
      (r, null, (select id from public.preps where user_id = owner and name = 'Fresh Lime Juice'), 20, 'ml', false);
  end if;

  -- 9. Cosmopolitan
  r := null;
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Cosmopolitan', 'Coupe', 'Ohne', 'shaken', 12.0, null,
      'Vodka, Cointreau, Limette und Cranberry.',
      'Vodka, Cointreau, lime and cranberry.')
    on conflict (user_id, lower(name)) do nothing returning id into r;
  if r is not null then
    insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
      (r, (select id from public.ingredients where user_id = owner and name = 'Absolut Vodka'), null, 40, 'ml', false),
      (r, (select id from public.ingredients where user_id = owner and name = 'Cointreau'), null, 15, 'ml', false),
      (r, null, (select id from public.preps where user_id = owner and name = 'Fresh Lime Juice'), 15, 'ml', false),
      (r, (select id from public.ingredients where user_id = owner and name = 'Cranberrynektar'), null, 30, 'ml', false);
  end if;

  -- 10. Whiskey Sour
  r := null;
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Whiskey Sour', 'Tumbler', 'Würfel', 'shaken', 12.0, null,
      'Bourbon, Zitrone, Zucker und Eiweiß — samtig.',
      'Bourbon, lemon, sugar and egg white — silky.')
    on conflict (user_id, lower(name)) do nothing returning id into r;
  if r is not null then
    insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
      (r, (select id from public.ingredients where user_id = owner and name = 'Bulleit Bourbon'), null, 50, 'ml', false),
      (r, null, (select id from public.preps where user_id = owner and name = 'Fresh Lemon Juice'), 25, 'ml', false),
      (r, null, (select id from public.preps where user_id = owner and name = 'Simple Syrup 1:1'), 20, 'ml', false),
      (r, (select id from public.ingredients where user_id = owner and name = 'Eier (10er)'), null, 1, 'piece', false);
  end if;
end $$;
