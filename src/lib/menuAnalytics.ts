import type { Library, Recipe, Settings } from '@/data/types';
import { indexLibrary } from '@/lib/libraryIndex';
import { costPct, effectiveTargetPct, grossMarginEur } from '@/lib/pricing';
import { recipePourCost } from '@/lib/recipeCost';

export type RagFlag = 'green' | 'amber' | 'red' | 'unpriced';

export interface MenuRow {
  recipe: Recipe;
  pourCost: number;
  priceGross: number | null;
  costPct: number | null;
  marginEur: number | null;
  flag: RagFlag;
}

export interface MenuAnalytics {
  rows: MenuRow[];
  avgCostPct: number | null;
  marginSpread: { min: number; max: number } | null;
  worstOffenderId: string | null;
}

/** RAG flag from a cost fraction against a target percentage. */
export function ragFlag(costPctFraction: number | null, targetPct: number): RagFlag {
  if (costPctFraction === null) return 'unpriced';
  const pct = costPctFraction * 100;
  if (pct <= targetPct) return 'green';
  if (pct <= targetPct * 1.25) return 'amber';
  return 'red';
}

export function menuAnalytics(menuId: string, lib: Library, settings: Settings): MenuAnalytics {
  const idx = indexLibrary(lib);
  const items = [...idx.menuItemsOf(menuId)].sort((a, b) => a.sort_order - b.sort_order);

  const rows: MenuRow[] = [];
  for (const item of items) {
    const recipe = idx.recipe(item.recipe_id);
    if (!recipe) continue;
    let pourCost: number;
    try {
      pourCost = recipePourCost(recipe.id, lib);
    } catch {
      continue; // recipe with a broken component — skip from the board
    }
    const pct = costPct(pourCost, recipe.price_gross);
    rows.push({
      recipe,
      pourCost,
      priceGross: recipe.price_gross,
      costPct: pct,
      marginEur: grossMarginEur(pourCost, recipe.price_gross),
      flag: ragFlag(pct, effectiveTargetPct(recipe.target_cost_pct_override, settings)),
    });
  }

  const priced = rows.filter((r) => r.costPct !== null);
  const avgCostPct =
    priced.length === 0
      ? null
      : priced.reduce((sum, r) => sum + (r.costPct ?? 0), 0) / priced.length;

  const margins = rows.map((r) => r.marginEur).filter((m): m is number => m !== null);
  const marginSpread =
    margins.length === 0 ? null : { min: Math.min(...margins), max: Math.max(...margins) };

  const worst = priced.reduce<MenuRow | null>(
    (acc, r) => (acc === null || (r.costPct ?? 0) > (acc.costPct ?? 0) ? r : acc),
    null,
  );

  return { rows, avgCostPct, marginSpread, worstOffenderId: worst?.recipe.id ?? null };
}

/** Display name of the worst-offending recipe, or the fallback when none. */
export function worstOffenderName(
  analytics: MenuAnalytics,
  lib: Library,
  fallback: string,
): string {
  if (analytics.worstOffenderId === null) return fallback;
  return indexLibrary(lib).recipe(analytics.worstOffenderId)?.name ?? fallback;
}
