-- PourSmith demo seeding — per-visitor sandbox.
-- Seeds ingredients, preps and the 10 classic recipes into the CURRENT user's
-- account (auth.uid()). Called by the app right after anonymous sign-in so every
-- portfolio visitor lands on a full, editable library isolated from everyone else.
--
-- Run ONCE in the Supabase SQL editor (after schema.sql, schema-epic2.sql).
-- SECURITY DEFINER so it can seed regardless of RLS, but every row is written
-- with user_id = auth.uid(), so callers only ever get their own data.

create or replace function public.seed_demo_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid := auth.uid();
  p_simple uuid;
  p_lime uuid;
  p_lemon uuid;
  p_oleo uuid;
  p_cordial uuid;
  r uuid;
begin
  if owner is null then
    raise exception 'seed_demo_data must be called by an authenticated user';
  end if;

  -- Idempotent: if this user already has a library, do nothing.
  if exists (select 1 from public.ingredients where user_id = owner) then
    return;
  end if;

  ------------------------------------------------------------------ ingredients
  insert into public.ingredients
    (user_id, name, category, pack_size, unit, price_gross, vat_rate, waste_pct)
  values
    (owner, 'Tanqueray London Dry Gin', 'spirit', 700, 'ml', 18.99, 0.19, 0),
    (owner, 'Monkey 47 Dry Gin',        'spirit', 500, 'ml', 36.90, 0.19, 0),
    (owner, 'Hendrick''s Gin',          'spirit', 700, 'ml', 29.99, 0.19, 0),
    (owner, 'Absolut Vodka',            'spirit', 700, 'ml', 13.99, 0.19, 0),
    (owner, 'Havana Club 3 Años',       'spirit', 700, 'ml', 14.99, 0.19, 0),
    (owner, 'Olmeca Blanco Tequila',    'spirit', 700, 'ml', 17.99, 0.19, 0),
    (owner, 'Bulleit Bourbon',          'spirit', 700, 'ml', 22.99, 0.19, 0),
    (owner, 'Campari',                  'liqueur', 700, 'ml', 14.99, 0.19, 0),
    (owner, 'Aperol',                   'liqueur', 700, 'ml', 12.99, 0.19, 0),
    (owner, 'Cointreau',                'liqueur', 700, 'ml', 19.99, 0.19, 0),
    (owner, 'Luxardo Maraschino',       'liqueur', 500, 'ml', 26.99, 0.19, 0),
    (owner, 'St-Germain',               'liqueur', 700, 'ml', 27.99, 0.19, 0),
    (owner, 'Noilly Prat Dry',          'other',  750, 'ml',  9.99, 0.19, 0),
    (owner, 'Fever-Tree Indian Tonic',  'other',  200, 'ml',  1.19, 0.19, 0),
    (owner, 'Sodawasser',               'other', 1000, 'ml',  0.79, 0.19, 0),
    (owner, 'Orangensaft (100%)',       'juice', 1000, 'ml',  2.49, 0.07, 0),
    (owner, 'Cranberrynektar',          'juice', 1000, 'ml',  2.29, 0.07, 0),
    (owner, 'Ananassaft',               'juice', 1000, 'ml',  2.19, 0.07, 0),
    (owner, 'Monin Vanille Sirup',      'syrup',  700, 'ml',  8.49, 0.19, 0),
    (owner, 'Zucker (weiß)',            'produce', 1000, 'g', 1.09, 0.07, 0),
    (owner, 'Limetten',                 'produce', 1, 'piece', 0.49, 0.07, 0),
    (owner, 'Zitronen',                 'produce', 1, 'piece', 0.59, 0.07, 0),
    (owner, 'Ingwer',                   'produce', 1000, 'g', 4.99, 0.07, 15),
    (owner, 'Minze (Bund)',             'produce', 1, 'piece', 1.29, 0.07, 10),
    (owner, 'Eier (10er)',              'produce', 10, 'piece', 3.49, 0.07, 0),
    (owner, 'Martini Rosso (Wermut)',   'other', 1000, 'ml', 8.99, 0.19, 0),
    (owner, 'Angostura Bitters',        'other',  200, 'ml', 12.99, 0.19, 0),
    (owner, 'Sekt Brut',                'other',  750, 'ml', 7.99, 0.19, 0);

  ------------------------------------------------------------------------ preps
  insert into public.preps (user_id, name, yield_amount, yield_unit, notes)
    values (owner, 'Simple Syrup 1:1', 1300, 'ml', 'Zucker + Wasser 1:1')
    returning id into p_simple;
  insert into public.preps (user_id, name, yield_amount, yield_unit, notes)
    values (owner, 'Fresh Lime Juice', 340, 'ml', null)
    returning id into p_lime;
  insert into public.preps (user_id, name, yield_amount, yield_unit, notes)
    values (owner, 'Fresh Lemon Juice', 400, 'ml', null)
    returning id into p_lemon;
  insert into public.preps (user_id, name, yield_amount, yield_unit, notes)
    values (owner, 'Oleo Saccharum', 450, 'ml', 'Zitronenschalen + Zucker, 24h')
    returning id into p_oleo;
  insert into public.preps (user_id, name, yield_amount, yield_unit, notes)
    values (owner, 'Citrus Cordial', 480, 'ml', 'Oleo + frischer Zitronensaft')
    returning id into p_cordial;

  insert into public.prep_lines (prep_id, ingredient_id, component_prep_id, amount) values
    (p_simple, (select id from public.ingredients where user_id = owner and name = 'Zucker (weiß)'), null, 800),
    (p_lime,   (select id from public.ingredients where user_id = owner and name = 'Limetten'), null, 12),
    (p_lemon,  (select id from public.ingredients where user_id = owner and name = 'Zitronen'), null, 10),
    (p_oleo,   (select id from public.ingredients where user_id = owner and name = 'Zitronen'), null, 8),
    (p_oleo,   (select id from public.ingredients where user_id = owner and name = 'Zucker (weiß)'), null, 500),
    (p_cordial, null, p_oleo, 300),
    (p_cordial, null, p_lemon, 200);

  ---------------------------------------------------------------------- recipes
  -- 1. Negroni
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Negroni', 'Tumbler', 'Großer Würfel', 'stirred', 12.0, null,
      'Gin, Campari und roter Wermut — bittersüßer Klassiker.',
      'Gin, Campari and sweet vermouth — the bittersweet classic.')
    returning id into r;
  insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
    (r, (select id from public.ingredients where user_id = owner and name = 'Tanqueray London Dry Gin'), null, 30, 'ml', false),
    (r, (select id from public.ingredients where user_id = owner and name = 'Campari'), null, 30, 'ml', false),
    (r, (select id from public.ingredients where user_id = owner and name = 'Martini Rosso (Wermut)'), null, 30, 'ml', false);

  -- 2. Old Fashioned
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Old Fashioned', 'Tumbler', 'Großer Würfel', 'stirred', 12.0, null,
      'Bourbon, ein Hauch Zucker und Angostura.',
      'Bourbon, a touch of sugar and Angostura bitters.')
    returning id into r;
  insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
    (r, (select id from public.ingredients where user_id = owner and name = 'Bulleit Bourbon'), null, 50, 'ml', false),
    (r, null, (select id from public.preps where user_id = owner and name = 'Simple Syrup 1:1'), 10, 'ml', false),
    (r, (select id from public.ingredients where user_id = owner and name = 'Angostura Bitters'), null, 2, 'dash', false);

  -- 3. French 75
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'French 75', 'Flöte', 'Ohne', 'shaken', 13.0, null,
      'Gin und Zitrone, mit Sekt aufgegossen.',
      'Gin and lemon, topped with sparkling wine.')
    returning id into r;
  insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
    (r, (select id from public.ingredients where user_id = owner and name = 'Tanqueray London Dry Gin'), null, 30, 'ml', false),
    (r, null, (select id from public.preps where user_id = owner and name = 'Fresh Lemon Juice'), 15, 'ml', false),
    (r, null, (select id from public.preps where user_id = owner and name = 'Simple Syrup 1:1'), 15, 'ml', false),
    (r, (select id from public.ingredients where user_id = owner and name = 'Sekt Brut'), null, 60, 'ml', false);

  -- 4. Martini
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Martini', 'Nick & Nora', 'Ohne', 'stirred', 13.0, null,
      'Gin und trockener Wermut, eiskalt gerührt.',
      'Gin and dry vermouth, stirred ice-cold.')
    returning id into r;
  insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
    (r, (select id from public.ingredients where user_id = owner and name = 'Monkey 47 Dry Gin'), null, 60, 'ml', false),
    (r, (select id from public.ingredients where user_id = owner and name = 'Noilly Prat Dry'), null, 10, 'ml', false);

  -- 5. Daiquiri
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Daiquiri', 'Coupe', 'Ohne', 'shaken', 11.0, null,
      'Weißer Rum, Limette, Zucker — perfekt balanciert.',
      'White rum, lime and sugar — perfectly balanced.')
    returning id into r;
  insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
    (r, (select id from public.ingredients where user_id = owner and name = 'Havana Club 3 Años'), null, 60, 'ml', false),
    (r, null, (select id from public.preps where user_id = owner and name = 'Fresh Lime Juice'), 25, 'ml', false),
    (r, null, (select id from public.preps where user_id = owner and name = 'Simple Syrup 1:1'), 15, 'ml', false);

  -- 6. Mojito
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Mojito', 'Highball', 'Crushed', 'built', 11.0, null,
      'Rum, Limette, Minze und Soda — spritzig und frisch.',
      'Rum, lime, mint and soda — long and refreshing.')
    returning id into r;
  insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
    (r, (select id from public.ingredients where user_id = owner and name = 'Havana Club 3 Años'), null, 50, 'ml', false),
    (r, null, (select id from public.preps where user_id = owner and name = 'Fresh Lime Juice'), 25, 'ml', false),
    (r, null, (select id from public.preps where user_id = owner and name = 'Simple Syrup 1:1'), 20, 'ml', false),
    (r, (select id from public.ingredients where user_id = owner and name = 'Minze (Bund)'), null, 0.2, 'piece', false),
    (r, (select id from public.ingredients where user_id = owner and name = 'Sodawasser'), null, 60, 'ml', false);

  -- 7. Manhattan
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Manhattan', 'Coupe', 'Ohne', 'stirred', 13.0, null,
      'Bourbon, roter Wermut und Angostura.',
      'Bourbon, sweet vermouth and Angostura.')
    returning id into r;
  insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
    (r, (select id from public.ingredients where user_id = owner and name = 'Bulleit Bourbon'), null, 50, 'ml', false),
    (r, (select id from public.ingredients where user_id = owner and name = 'Martini Rosso (Wermut)'), null, 20, 'ml', false),
    (r, (select id from public.ingredients where user_id = owner and name = 'Angostura Bitters'), null, 2, 'dash', false);

  -- 8. Margarita
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Margarita', 'Coupe', 'Würfel', 'shaken', 12.0, null,
      'Tequila, Cointreau und Limette.',
      'Tequila, Cointreau and lime.')
    returning id into r;
  insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
    (r, (select id from public.ingredients where user_id = owner and name = 'Olmeca Blanco Tequila'), null, 50, 'ml', false),
    (r, (select id from public.ingredients where user_id = owner and name = 'Cointreau'), null, 20, 'ml', false),
    (r, null, (select id from public.preps where user_id = owner and name = 'Fresh Lime Juice'), 20, 'ml', false);

  -- 9. Cosmopolitan
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Cosmopolitan', 'Coupe', 'Ohne', 'shaken', 12.0, null,
      'Vodka, Cointreau, Limette und Cranberry.',
      'Vodka, Cointreau, lime and cranberry.')
    returning id into r;
  insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
    (r, (select id from public.ingredients where user_id = owner and name = 'Absolut Vodka'), null, 40, 'ml', false),
    (r, (select id from public.ingredients where user_id = owner and name = 'Cointreau'), null, 15, 'ml', false),
    (r, null, (select id from public.preps where user_id = owner and name = 'Fresh Lime Juice'), 15, 'ml', false),
    (r, (select id from public.ingredients where user_id = owner and name = 'Cranberrynektar'), null, 30, 'ml', false);

  -- 10. Whiskey Sour
  insert into public.recipes (user_id, name, glass, ice, method, price_gross, notes, description_de, description_en)
    values (owner, 'Whiskey Sour', 'Tumbler', 'Würfel', 'shaken', 12.0, null,
      'Bourbon, Zitrone, Zucker und Eiweiß — samtig.',
      'Bourbon, lemon, sugar and egg white — silky.')
    returning id into r;
  insert into public.recipe_lines (recipe_id, ingredient_id, component_prep_id, amount, unit, is_garnish) values
    (r, (select id from public.ingredients where user_id = owner and name = 'Bulleit Bourbon'), null, 50, 'ml', false),
    (r, null, (select id from public.preps where user_id = owner and name = 'Fresh Lemon Juice'), 25, 'ml', false),
    (r, null, (select id from public.preps where user_id = owner and name = 'Simple Syrup 1:1'), 20, 'ml', false),
    (r, (select id from public.ingredients where user_id = owner and name = 'Eier (10er)'), null, 1, 'piece', false);
end $$;

-- Allow the app (anon + authenticated) to invoke it.
grant execute on function public.seed_demo_data() to anon, authenticated;
