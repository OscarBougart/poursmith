import { describe, expect, it } from 'vitest';
import type {
  Ingredient,
  Library,
  NewRecipeLine,
  Prep,
  PrepLine,
  Recipe,
  RecipeLine,
} from '@/data/types';
import { CostError } from '@/lib/cost';
import { UnitError } from '@/lib/units';
import { recipeLineCost, recipePourCost } from '@/lib/recipeCost';

function ing(over: Partial<Ingredient> & { id: string }): Ingredient {
  return {
    name: over.id,
    category: 'other',
    pack_size: 1000,
    unit: 'g',
    price_gross: 11.9,
    vat_rate: 0.19,
    price_net: 10,
    waste_pct: 0,
    created_at: '',
    updated_at: '',
    ...over,
  };
}

function prep(over: Partial<Prep> & { id: string }): Prep {
  return {
    name: over.id,
    yield_amount: 1000,
    yield_unit: 'ml',
    notes: null,
    created_at: '',
    updated_at: '',
    ...over,
  };
}

let seq = 0;
function prepLine(over: Partial<PrepLine> & { prep_id: string; amount: number }): PrepLine {
  seq += 1;
  return { id: `pl-${seq}`, ingredient_id: null, component_prep_id: null, ...over };
}

function recipe(over: Partial<Recipe> & { id: string }): Recipe {
  return {
    name: over.id,
    glass: null,
    ice: null,
    method: 'shaken',
    price_gross: null,
    target_cost_pct_override: null,
    notes: null,
    created_at: '',
    updated_at: '',
    ...over,
  };
}

function recipeLine(over: Partial<RecipeLine> & { recipe_id: string; amount: number }): RecipeLine {
  seq += 1;
  return {
    id: `rl-${seq}`,
    ingredient_id: null,
    component_prep_id: null,
    unit: 'ml',
    is_garnish: false,
    ...over,
  };
}

function makeLib(over: Partial<Library>): Library {
  return { ingredients: [], preps: [], prepLines: [], recipes: [], recipeLines: [], ...over };
}

const gin = ing({ id: 'gin', unit: 'ml', pack_size: 700, price_net: 14 }); // 0.02 €/ml
const sugar = ing({ id: 'sugar', price_net: 1, pack_size: 1000, unit: 'g' }); // 0.001 €/g
const lemon = ing({ id: 'lemon', price_net: 0.5, pack_size: 1, unit: 'piece' });
const lime = ing({ id: 'lime', price_net: 0.4, pack_size: 1, unit: 'piece', waste_pct: 20 }); // 0.50 €/piece

const chainPreps = [
  prep({ id: 'lemonJuice', yield_amount: 400 }),
  prep({ id: 'oleo', yield_amount: 450 }),
  prep({ id: 'cordial', yield_amount: 480 }),
];
const chainLines = [
  prepLine({ prep_id: 'lemonJuice', ingredient_id: 'lemon', amount: 10 }),
  prepLine({ prep_id: 'oleo', ingredient_id: 'lemon', amount: 8 }),
  prepLine({ prep_id: 'oleo', ingredient_id: 'sugar', amount: 500 }),
  prepLine({ prep_id: 'cordial', component_prep_id: 'oleo', amount: 300 }),
  prepLine({ prep_id: 'cordial', component_prep_id: 'lemonJuice', amount: 200 }),
];

describe('recipeLineCost', () => {
  const lib = makeLib({ ingredients: [gin, sugar, lime] });

  function newLine(over: Partial<NewRecipeLine>): NewRecipeLine {
    return { ingredient_id: null, component_prep_id: null, amount: 1, unit: 'ml', is_garnish: false, ...over };
  }

  it('converts oz lines to ml before costing', () => {
    expect(recipeLineCost(newLine({ ingredient_id: 'gin', amount: 2, unit: 'oz' }), lib)).toBeCloseTo(1.2, 12);
  });
  it('costs g lines against g ingredients', () => {
    expect(recipeLineCost(newLine({ ingredient_id: 'sugar', amount: 50, unit: 'g' }), lib)).toBeCloseTo(0.05, 12);
  });
  it('throws UnitError on unit mismatch', () => {
    expect(() => recipeLineCost(newLine({ ingredient_id: 'sugar', amount: 1, unit: 'oz' }), lib)).toThrowError(UnitError);
  });
  it('throws CostError for unknown components', () => {
    expect(() => recipeLineCost(newLine({ ingredient_id: 'ghost', amount: 1 }), lib)).toThrowError(CostError);
  });
});

describe('recipePourCost', () => {
  const lib = makeLib({
    ingredients: [gin, sugar, lemon, lime],
    preps: chainPreps,
    prepLines: chainLines,
    recipes: [recipe({ id: 'ginSour' })],
    recipeLines: [
      recipeLine({ recipe_id: 'ginSour', ingredient_id: 'gin', amount: 2, unit: 'oz' }),
      recipeLine({ recipe_id: 'ginSour', component_prep_id: 'cordial', amount: 20, unit: 'ml' }),
      recipeLine({ recipe_id: 'ginSour', ingredient_id: 'lime', amount: 1, unit: 'piece', is_garnish: true }),
    ],
  });

  it('sums converted lines over nested preps, waste and garnish', () => {
    // gin 60 ml × 0.02 = 1.20; cordial 20 × (5.5/480); lime garnish 0.50
    const expected = 1.2 + 20 * (5.5 / 480) + 0.5;
    expect(recipePourCost('ginSour', lib)).toBeCloseTo(expected, 10);
  });
  it('throws CostError for an unknown recipe', () => {
    expect(() => recipePourCost('nope', lib)).toThrowError(CostError);
  });
});
