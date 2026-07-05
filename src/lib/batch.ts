import type { Library, Method, RecipeLine, RecipeUnit } from '@/data/types';
import { lineComponentName } from '@/lib/component';
import { CostError } from '@/lib/cost';
import { indexLibrary } from '@/lib/libraryIndex';
import { recipeLineCost } from '@/lib/recipeCost';
import { toMl } from '@/lib/units';

/** % of pre-dilution volume added as water, by method. */
export const DILUTION_PRESETS: Record<Method, number> = {
  shaken: 25,
  stirred: 20,
  built: 10,
  thrown: 15,
};

export interface BatchLine {
  name: string;
  amount: number;
  unit: RecipeUnit;
  amountMl: number | null;
  cost: number;
}

export interface BatchSheet {
  lines: BatchLine[];
  waterMl: number;
  totalVolumeMl: number;
  totalCost: number;
  costPerServe: number;
  serves: number;
}

function linesOf(recipeId: string, lib: Library): RecipeLine[] {
  const idx = indexLibrary(lib);
  if (!idx.recipe(recipeId)) throw new CostError(`Unknown recipe: ${recipeId}`, 'missing');
  return idx.recipeLinesOf(recipeId);
}

/** Pre-dilution liquid volume of one serve in ml; g/piece lines carry no volume. */
export function preDilutionVolumeMl(recipeId: string, lib: Library): number {
  let total = 0;
  for (const line of linesOf(recipeId, lib)) {
    total += toMl(line.amount, line.unit) ?? 0;
  }
  return total;
}

function buildSheet(recipeId: string, lib: Library, scale: number, dilutionPct: number): BatchSheet {
  const volume = preDilutionVolumeMl(recipeId, lib);
  let totalCost = 0;
  const lines: BatchLine[] = linesOf(recipeId, lib).map((line) => {
    const cost = recipeLineCost(line, lib) * scale;
    totalCost += cost;
    const ml = toMl(line.amount, line.unit);
    return {
      name: lineComponentName(line, lib),
      amount: line.amount * scale,
      unit: line.unit,
      amountMl: ml === null ? null : ml * scale,
      cost,
    };
  });
  const waterMl = volume * scale * (dilutionPct / 100);
  return {
    lines,
    waterMl,
    totalVolumeMl: volume * scale + waterMl,
    totalCost,
    costPerServe: scale === 0 ? 0 : totalCost / scale,
    serves: scale,
  };
}

export function batchForServes(
  recipeId: string,
  lib: Library,
  serves: number,
  dilutionPct: number,
): BatchSheet {
  return buildSheet(recipeId, lib, serves, dilutionPct);
}

export function batchForVolume(
  recipeId: string,
  lib: Library,
  targetMl: number,
  dilutionPct: number,
): BatchSheet {
  const perServe = preDilutionVolumeMl(recipeId, lib) * (1 + dilutionPct / 100);
  const scale = perServe === 0 ? 0 : targetMl / perServe;
  return buildSheet(recipeId, lib, scale, dilutionPct);
}
