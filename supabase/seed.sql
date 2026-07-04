-- PourSmith Epic 1 seed. Run AFTER schema.sql and after creating the owner account.
do $$
declare
  owner uuid;
  p_simple uuid;
  p_lime uuid;
  p_lemon uuid;
  p_oleo uuid;
  p_cordial uuid;
begin
  select id into owner from auth.users order by created_at limit 1;
  if owner is null then
    raise exception 'No user found — create the owner account first.';
  end if;

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
    (owner, 'Eier (10er)',              'produce', 10, 'piece', 3.49, 0.07, 0);

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
end $$;
