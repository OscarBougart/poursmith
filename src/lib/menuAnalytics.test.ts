import { describe, expect, it } from 'vitest';
import type {
  Ingredient,
  Library,
  Menu,
  MenuItem,
  Recipe,
  RecipeLine,
} from '@/data/types';
import { menuAnalytics, ragFlag } from '@/lib/menuAnalytics';

function makeLib(over: Partial<Library>): Library {
  return {
    ingredients: [],
    preps: [],
    prepLines: [],
    recipes: [],
    recipeLines: [],
    menus: [],
    menuItems: [],
    ...over,
  };
}

function ing(over: Partial<Ingredient> & { id: string }): Ingredient {
  return {
    name: over.id,
    category: 'other',
    pack_size: 1000,
    unit: 'ml',
    price_gross: 11.9,
    vat_rate: 0.19,
    price_net: 10,
    waste_pct: 0,
    created_at: '',
    updated_at: '',
    ...over,
  };
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
    description_de: null,
    description_en: null,
    created_at: '',
    updated_at: '',
    ...over,
  };
}

let seq = 0;
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

function menu(id: string): Menu {
  return { id, name: id, created_at: '', updated_at: '' };
}

function menuItem(over: Partial<MenuItem> & { menu_id: string; recipe_id: string }): MenuItem {
  seq += 1;
  return { id: `mi-${seq}`, sort_order: 0, ...over };
}

const settings = { target_cost_pct: 20 };

describe('ragFlag', () => {
  it('flags unpriced when cost% is null', () => {
    expect(ragFlag(null, 20)).toBe('unpriced');
  });
  it('is green at or below target', () => {
    expect(ragFlag(0.2, 20)).toBe('green');
    expect(ragFlag(0.1, 20)).toBe('green');
  });
  it('is amber up to 1.25x target', () => {
    expect(ragFlag(0.201, 20)).toBe('amber');
    expect(ragFlag(0.25, 20)).toBe('amber');
  });
  it('is red above 1.25x target', () => {
    expect(ragFlag(0.2501, 20)).toBe('red');
  });
});

describe('menuAnalytics', () => {
  // ingredient at 0.01 €/ml net (net 10 / 1000 ml)
  const base = ing({ id: 'spirit', pack_size: 1000, price_net: 10 });
  const lib = makeLib({
    ingredients: [base],
    recipes: [
      // A: price 10 gross → net 8.4034; pour 1.0 → cost% 0.119 → green
      recipe({ id: 'A', price_gross: 10 }),
      // B: price 12 gross → net 10.084; pour 3.0 → cost% 0.2975 → red
      recipe({ id: 'B', price_gross: 12 }),
      // C: unpriced
      recipe({ id: 'C', price_gross: null }),
    ],
    recipeLines: [
      recipeLine({ recipe_id: 'A', ingredient_id: 'spirit', amount: 100 }), // 100 ml × 0.01 = 1.0
      recipeLine({ recipe_id: 'B', ingredient_id: 'spirit', amount: 300 }), // 300 ml × 0.01 = 3.0
      recipeLine({ recipe_id: 'C', ingredient_id: 'spirit', amount: 100 }),
    ],
    menus: [menu('M')],
    menuItems: [
      menuItem({ menu_id: 'M', recipe_id: 'A', sort_order: 0 }),
      menuItem({ menu_id: 'M', recipe_id: 'B', sort_order: 1 }),
      menuItem({ menu_id: 'M', recipe_id: 'C', sort_order: 2 }),
    ],
  });

  it('produces rows in sort order with flags', () => {
    const a = menuAnalytics('M', lib, settings);
    expect(a.rows.map((r) => r.recipe.id)).toEqual(['A', 'B', 'C']);
    expect(a.rows.map((r) => r.flag)).toEqual(['green', 'red', 'unpriced']);
  });

  it('averages cost% over priced drinks only', () => {
    const a = menuAnalytics('M', lib, settings);
    const expected = (0.1 / 0.840336 + 3 / (12 / 1.19) / 1) / 1; // computed below precisely
    // A cost% = 1.0 / (10/1.19); B cost% = 3.0 / (12/1.19)
    const aPct = 1.0 / (10 / 1.19);
    const bPct = 3.0 / (12 / 1.19);
    expect(a.avgCostPct).toBeCloseTo((aPct + bPct) / 2, 10);
    void expected;
  });

  it('reports margin spread across priced drinks', () => {
    const a = menuAnalytics('M', lib, settings);
    const aMargin = 10 / 1.19 - 1.0;
    const bMargin = 12 / 1.19 - 3.0;
    expect(a.marginSpread).not.toBeNull();
    expect(a.marginSpread?.min).toBeCloseTo(Math.min(aMargin, bMargin), 10);
    expect(a.marginSpread?.max).toBeCloseTo(Math.max(aMargin, bMargin), 10);
  });

  it('names the worst offender as the highest cost% priced drink', () => {
    const a = menuAnalytics('M', lib, settings);
    expect(a.worstOffenderId).toBe('B');
  });

  it('returns nulls for an empty menu', () => {
    const empty = makeLib({ menus: [menu('E')] });
    const a = menuAnalytics('E', empty, settings);
    expect(a.rows).toEqual([]);
    expect(a.avgCostPct).toBeNull();
    expect(a.marginSpread).toBeNull();
    expect(a.worstOffenderId).toBeNull();
  });
});
