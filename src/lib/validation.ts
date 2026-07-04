import type { Category, NewIngredient, Unit } from '@/data/types';
import type { MessageKey } from '@/i18n';
import { parseDecimal, parseVatRate } from '@/lib/parse';

export interface IngredientFormValues {
  name: string;
  category: Category;
  pack_size: string;
  unit: Unit;
  price_gross: string;
  vat_rate: string;
  waste_pct: string;
}

export type IngredientFormErrors = Partial<Record<keyof IngredientFormValues, MessageKey>>;

export interface IngredientValidationResult {
  errors: IngredientFormErrors;
  value: NewIngredient | null;
}

export function validateIngredient(
  v: IngredientFormValues,
  takenNames: string[],
): IngredientValidationResult {
  const errors: IngredientFormErrors = {};

  const name = v.name.trim();
  if (name === '') {
    errors.name = 'validation.required';
  } else if (takenNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
    errors.name = 'validation.nameTaken';
  }

  const packSize = parseDecimal(v.pack_size);
  if (packSize === null || packSize <= 0) errors.pack_size = 'validation.positive';

  const priceGross = parseDecimal(v.price_gross);
  if (priceGross === null || priceGross < 0) errors.price_gross = 'validation.nonNegative';

  const vatRate = parseVatRate(v.vat_rate);
  if (vatRate === null) errors.vat_rate = 'validation.vat';

  const wastePct = v.waste_pct.trim() === '' ? 0 : parseDecimal(v.waste_pct);
  if (wastePct === null || wastePct < 0 || wastePct >= 100) {
    errors.waste_pct = 'validation.wasteRange';
  }

  if (Object.keys(errors).length > 0) return { errors, value: null };
  return {
    errors,
    value: {
      name,
      category: v.category,
      pack_size: packSize as number,
      unit: v.unit,
      price_gross: priceGross as number,
      vat_rate: vatRate as number,
      waste_pct: wastePct as number,
    },
  };
}
