import type { Settings } from '@/data/types';

export const SALES_VAT = 0.19;
const DEFAULT_TARGET_PCT = 20;
const EPSILON = 1e-9;

export function netOfVat(gross: number): number {
  return gross / (1 + SALES_VAT);
}

/** Net purchase price at a given VAT rate, rounded to 4 dp to match the DB. */
export function priceNet(gross: number, vatRate: number): number {
  return Math.round((gross / (1 + vatRate)) * 1e4) / 1e4;
}

/** Pour cost over net selling price, as a fraction (0.2 = 20 %). Null without a usable price. */
export function costPct(pourCost: number, priceGross: number | null): number | null {
  if (priceGross === null || priceGross <= 0) return null;
  return pourCost / netOfVat(priceGross);
}

/** Net selling price minus pour cost, in €. Null without a usable price. */
export function grossMarginEur(pourCost: number, priceGross: number | null): number | null {
  if (priceGross === null || priceGross <= 0) return null;
  return netOfVat(priceGross) - pourCost;
}

export function effectiveTargetPct(
  override: number | null,
  settings: Settings | null,
): number {
  return override ?? settings?.target_cost_pct ?? DEFAULT_TARGET_PCT;
}

/** Rounds up to the next multiple of step; epsilon keeps exact multiples in place. */
export function roundUpTo(step: number, value: number): number {
  return Math.ceil((value - EPSILON) / step) * step;
}

/** Gross price hitting the target cost %, rounded up to the next 0,50. */
export function suggestedPriceGross(pourCost: number, targetPct: number): number {
  const grossExact = (pourCost / (targetPct / 100)) * (1 + SALES_VAT);
  return roundUpTo(0.5, grossExact);
}
