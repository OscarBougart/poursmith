import type { RecipeUnit, Unit } from '@/data/types';

export const VOLUME_FACTORS_ML = { ml: 1, cl: 10, oz: 30, dash: 0.8, barspoon: 5 } as const;
export type VolumeUnit = keyof typeof VOLUME_FACTORS_ML;

export class UnitError extends Error {
  readonly from: RecipeUnit;
  readonly to: Unit;

  constructor(from: RecipeUnit, to: Unit) {
    super(`Cannot convert ${from} to ${to}`);
    this.name = 'UnitError';
    this.from = from;
    this.to = to;
  }
}

export function isVolumeUnit(unit: string): unit is VolumeUnit {
  return unit in VOLUME_FACTORS_ML;
}

/** Millilitres for volume units, null for g/piece. */
export function toMl(amount: number, from: RecipeUnit): number | null {
  return isVolumeUnit(from) ? amount * VOLUME_FACTORS_ML[from] : null;
}

/** Converts a recipe-line amount to a component's native unit (ml, g or piece). */
export function convertAmount(amount: number, from: RecipeUnit, to: Unit): number {
  if (to === 'ml' && isVolumeUnit(from)) return amount * VOLUME_FACTORS_ML[from];
  if (from === to) return amount; // g→g, piece→piece
  throw new UnitError(from, to);
}
