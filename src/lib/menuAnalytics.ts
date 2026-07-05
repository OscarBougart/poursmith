import type { Library, Recipe, Settings } from '@/data/types';
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
  const items = lib.menuItems
    .filter((i) => i.menu_id === menuId)
    .sort((a, b) => a.sort_order - b.sort_order);

  const rows: MenuRow[] = [];
  for (const item of items) {
    const recipe = lib.recipes.find((r) => r.id === item.recipe_id);
    if (!recipe) continue;
    let pourCost: number;
    try {
      pourCost = recipePourCost(recipe.id, lib);
    } catch {
      continue; // recipe with a broken component — skip from the board
    }
    const pct = costPct(pourCost, recipe.price_gross);
    const target = effectiveTargetPct(recipe.target_cost_pct_override, settings);
    rows.push({
      recipe,
      pourCost,
      priceGross: recipe.price_gross,
      costPct: pct,
      marginEur: grossMarginEur(pourCost, recipe.price_gross),
      flag: ragFlag(pct, target),
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

  let worstOffenderId: string | null = null;
  let worstPct = -Infinity;
  for (const row of priced) {
    if ((row.costPct ?? 0) > worstPct) {
      worstPct = row.costPct ?? 0;
      worstOffenderId = row.recipe.id;
    }
  }

  return { rows, avgCostPct, marginSpread, worstOffenderId };
}
