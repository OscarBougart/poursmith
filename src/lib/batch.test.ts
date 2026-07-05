import { describe, expect, it } from 'vitest';
import type { Ingredient, Library, Prep, PrepLine, Recipe, RecipeLine } from '@/data/types';
import { DILUTION_PRESETS, batchForServes, batchForVolume, preDilutionVolumeMl } from '@/lib/batch';

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

const recipeRow: Recipe = {
  id: 'sour',
  name: 'Sour',
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
};

// gin 0.02 €/ml; cordial prep 0.01 €/ml (sugar 4.5 € into 450 ml); lime 0.50 €/piece
const lib: Library = {
  ingredients: [
    ing({ id: 'gin', pack_size: 700, price_net: 14 }),
    ing({ id: 'sugar', unit: 'g', pack_size: 1000, price_net: 9 }),
    ing({ id: 'lime', unit: 'piece', pack_size: 1, price_net: 0.5 }),
  ],
  preps: [prep({ id: 'cordial', yield_amount: 450 })],
  prepLines: [prepLine({ prep_id: 'cordial', ingredient_id: 'sugar', amount: 500 })],
  recipes: [recipeRow],
  recipeLines: [
    recipeLine({ recipe_id: 'sour', ingredient_id: 'gin', amount: 60, unit: 'ml' }),
    recipeLine({ recipe_id: 'sour', component_prep_id: 'cordial', amount: 1, unit: 'oz' }),
    recipeLine({ recipe_id: 'sour', ingredient_id: 'lime', amount: 1, unit: 'piece', is_garnish: true }),
  ],
  menus: [],
  menuItems: [],
};

// per serve: gin 60 ml → 1.20 €; cordial 30 ml → 0.135 €; lime → 0.50 €
const PER_SERVE_COST = 1.2 + 30 * (4.5 / 450) / 1 + 0.5;
const V = 90; // 60 ml + 1 oz; piece excluded

describe('DILUTION_PRESETS', () => {
  it('matches the spec values', () => {
    expect(DILUTION_PRESETS.shaken).toBe(25);
    expect(DILUTION_PRESETS.stirred).toBe(20);
    expect(DILUTION_PRESETS.built).toBe(10);
    expect(DILUTION_PRESETS.thrown).toBe(15);
  });
});

describe('preDilutionVolumeMl', () => {
  it('sums volume lines in ml, excluding piece/g lines', () => {
    expect(preDilutionVolumeMl('sour', lib)).toBeCloseTo(V, 12);
  });
});

describe('batchForServes', () => {
  const sheet = batchForServes('sour', lib, 10, 25);

  it('scales line amounts and costs', () => {
    const ginLine = sheet.lines.find((l) => l.name === 'gin');
    expect(ginLine?.amount).toBeCloseTo(600, 12);
    expect(ginLine?.amountMl).toBeCloseTo(600, 12);
    const limeLine = sheet.lines.find((l) => l.name === 'lime');
    expect(limeLine?.amount).toBeCloseTo(10, 12);
    expect(limeLine?.amountMl).toBeNull();
  });
  it('computes water, volume and costs', () => {
    expect(sheet.waterMl).toBeCloseTo(V * 10 * 0.25, 12);
    expect(sheet.totalVolumeMl).toBeCloseTo(V * 10 * 1.25, 12);
    expect(sheet.totalCost).toBeCloseTo(PER_SERVE_COST * 10, 10);
    expect(sheet.costPerServe).toBeCloseTo(PER_SERVE_COST, 10);
    expect(sheet.serves).toBe(10);
  });
});

describe('batchForVolume', () => {
  it('solves serves from the target volume including dilution', () => {
    const sheet = batchForVolume('sour', lib, V * 10 * 1.25, 25);
    expect(sheet.serves).toBeCloseTo(10, 10);
    expect(sheet.totalVolumeMl).toBeCloseTo(V * 10 * 1.25, 10);
    expect(sheet.costPerServe).toBeCloseTo(PER_SERVE_COST, 10);
  });
});
