import { describe, expect, it } from 'vitest';
import type { Ingredient, Library, Prep, PrepLine } from '@/data/types';
import {
  CostError,
  ingredientUnitCost,
  prepTotalCost,
  prepUnitCost,
  wouldCreateCycle,
} from '@/lib/cost';

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

let lineSeq = 0;
function line(over: Partial<PrepLine> & { prep_id: string; amount: number }): PrepLine {
  lineSeq += 1;
  return { id: `line-${lineSeq}`, ingredient_id: null, component_prep_id: null, ...over };
}

describe('ingredientUnitCost', () => {
  it('divides net price by pack size', () => {
    expect(ingredientUnitCost(ing({ id: 'a', price_net: 10, pack_size: 500 }))).toBe(0.02);
  });
  it('inflates cost by waste percentage', () => {
    expect(ingredientUnitCost(ing({ id: 'a', price_net: 10, pack_size: 500, waste_pct: 20 }))).toBeCloseTo(0.025, 12);
  });
});

describe('prepUnitCost', () => {
  const sugar = ing({ id: 'sugar', price_net: 1, pack_size: 1000, unit: 'g' });

  it('costs a single-level prep from its lines over its yield', () => {
    const lib: Library = {
      ingredients: [sugar],
      preps: [prep({ id: 'simple', yield_amount: 1300 })],
      prepLines: [line({ prep_id: 'simple', ingredient_id: 'sugar', amount: 800 })],
    };
    expect(prepUnitCost('simple', lib)).toBeCloseTo(0.8 / 1300, 12);
  });

  function chainLib(lemonNet: number): Library {
    const lemonIng = ing({ id: 'lemon', price_net: lemonNet, pack_size: 1, unit: 'piece' });
    return {
      ingredients: [sugar, lemonIng],
      preps: [
        prep({ id: 'lemonJuice', yield_amount: 400 }),
        prep({ id: 'oleo', yield_amount: 450 }),
        prep({ id: 'cordial', yield_amount: 480 }),
      ],
      prepLines: [
        line({ prep_id: 'lemonJuice', ingredient_id: 'lemon', amount: 10 }),
        line({ prep_id: 'oleo', ingredient_id: 'lemon', amount: 8 }),
        line({ prep_id: 'oleo', ingredient_id: 'sugar', amount: 500 }),
        line({ prep_id: 'cordial', component_prep_id: 'oleo', amount: 300 }),
        line({ prep_id: 'cordial', component_prep_id: 'lemonJuice', amount: 200 }),
      ],
    };
  }

  it('resolves a two-level prep chain from leaf ingredient prices', () => {
    const lib = chainLib(0.5);
    // oleo: 8 × 0.50 + 500 × 0.001 = 4.50 over 450 ml = 0.01 €/ml
    expect(prepUnitCost('oleo', lib)).toBeCloseTo(0.01, 12);
    // cordial: 300 × 0.01 + 200 × (10 × 0.5 / 400) = 3.00 + 2.50 = 5.50 over 480 ml
    expect(prepUnitCost('cordial', lib)).toBeCloseTo(5.5 / 480, 12);
  });

  it('propagates a leaf price change through the chain', () => {
    const doubled = chainLib(1);
    const expected = (300 * (8.5 / 450) + 200 * (10 / 400)) / 480;
    expect(prepUnitCost('cordial', doubled)).toBeCloseTo(expected, 12);
  });

  it('computes total batch cost as unit cost times yield', () => {
    const lib = chainLib(0.5);
    expect(prepTotalCost('cordial', lib)).toBeCloseTo(5.5, 12);
  });

  it('throws a cycle error on circular references', () => {
    const lib: Library = {
      ingredients: [],
      preps: [prep({ id: 'A', yield_amount: 100 }), prep({ id: 'B', yield_amount: 100 })],
      prepLines: [
        line({ prep_id: 'A', component_prep_id: 'B', amount: 50 }),
        line({ prep_id: 'B', component_prep_id: 'A', amount: 50 }),
      ],
    };
    expect(() => prepUnitCost('A', lib)).toThrowError(CostError);
    try {
      prepUnitCost('A', lib);
    } catch (e) {
      expect(e).toBeInstanceOf(CostError);
      expect((e as CostError).code).toBe('cycle');
    }
  });

  it('throws a missing error for unknown components', () => {
    const lib: Library = {
      ingredients: [],
      preps: [prep({ id: 'A', yield_amount: 100 })],
      prepLines: [line({ prep_id: 'A', ingredient_id: 'ghost', amount: 10 })],
    };
    try {
      prepUnitCost('A', lib);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CostError);
      expect((e as CostError).code).toBe('missing');
    }
    expect(() => prepUnitCost('nope', { ingredients: [], preps: [], prepLines: [] })).toThrowError(CostError);
  });
});

describe('wouldCreateCycle', () => {
  const lib: Library = {
    ingredients: [],
    preps: [
      prep({ id: 'A', yield_amount: 100 }),
      prep({ id: 'B', yield_amount: 100 }),
      prep({ id: 'C', yield_amount: 100 }),
    ],
    // B already contains A
    prepLines: [line({ prep_id: 'B', component_prep_id: 'A', amount: 10 })],
  };

  it('detects that adding B into A would close a loop', () => {
    expect(wouldCreateCycle('A', 'B', lib)).toBe(true);
  });
  it('allows unrelated components', () => {
    expect(wouldCreateCycle('A', 'C', lib)).toBe(false);
  });
  it('rejects self-reference', () => {
    expect(wouldCreateCycle('A', 'A', lib)).toBe(true);
  });
});
