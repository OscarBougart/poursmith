import { describe, expect, it } from 'vitest';
import type { IngredientFormValues } from '@/lib/validation';
import { validateIngredient } from '@/lib/validation';

function values(over: Partial<IngredientFormValues> = {}): IngredientFormValues {
  return {
    name: 'Campari',
    category: 'liqueur',
    pack_size: '700',
    unit: 'ml',
    price_gross: '14,99',
    vat_rate: '19',
    waste_pct: '0',
    ...over,
  };
}

describe('validateIngredient', () => {
  it('accepts valid values with decimal commas', () => {
    const { errors, value } = validateIngredient(values(), []);
    expect(errors).toEqual({});
    expect(value).toEqual({
      name: 'Campari',
      category: 'liqueur',
      pack_size: 700,
      unit: 'ml',
      price_gross: 14.99,
      vat_rate: 0.19,
      waste_pct: 0,
    });
  });

  it('treats empty waste as zero', () => {
    const { value } = validateIngredient(values({ waste_pct: '' }), []);
    expect(value?.waste_pct).toBe(0);
  });

  it('requires a name', () => {
    const { errors, value } = validateIngredient(values({ name: '  ' }), []);
    expect(errors.name).toBe('validation.required');
    expect(value).toBeNull();
  });

  it('rejects a taken name case-insensitively', () => {
    const { errors } = validateIngredient(values({ name: 'CAMPARI' }), ['Campari']);
    expect(errors.name).toBe('validation.nameTaken');
  });

  it('rejects non-positive pack size', () => {
    expect(validateIngredient(values({ pack_size: '0' }), []).errors.pack_size).toBe('validation.positive');
    expect(validateIngredient(values({ pack_size: 'abc' }), []).errors.pack_size).toBe('validation.positive');
  });

  it('rejects negative gross price but allows zero', () => {
    expect(validateIngredient(values({ price_gross: '-1' }), []).errors.price_gross).toBe('validation.nonNegative');
    expect(validateIngredient(values({ price_gross: '0' }), []).errors.price_gross).toBeUndefined();
  });

  it('rejects invalid vat rates', () => {
    expect(validateIngredient(values({ vat_rate: '5' }), []).errors.vat_rate).toBe('validation.vat');
  });

  it('rejects waste outside [0, 100)', () => {
    expect(validateIngredient(values({ waste_pct: '100' }), []).errors.waste_pct).toBe('validation.wasteRange');
    expect(validateIngredient(values({ waste_pct: '-3' }), []).errors.waste_pct).toBe('validation.wasteRange');
  });
});
