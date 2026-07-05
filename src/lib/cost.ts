import type { Ingredient, Library } from '@/data/types';
import { indexLibrary } from '@/lib/libraryIndex';
import type { LibraryIndex } from '@/lib/libraryIndex';

export class CostError extends Error {
  readonly code: 'cycle' | 'missing';

  constructor(message: string, code: 'cycle' | 'missing') {
    super(message);
    this.name = 'CostError';
    this.code = code;
  }
}

/** € per ml/g/piece, net of VAT, inflated by waste. */
export function ingredientUnitCost(ingredient: Ingredient): number {
  return ingredient.price_net / ingredient.pack_size / (1 - ingredient.waste_pct / 100);
}

/** € per yield unit of a prep, resolving nested preps recursively. */
export function prepUnitCost(prepId: string, lib: Library): number {
  return resolve(prepId, indexLibrary(lib), new Map(), new Set());
}

/** Cost of one full batch of a prep (unit cost × yield). */
export function prepTotalCost(prepId: string, lib: Library): number {
  const idx = indexLibrary(lib);
  const prep = idx.prep(prepId);
  if (!prep) throw new CostError(`Unknown prep: ${prepId}`, 'missing');
  return resolve(prepId, idx, new Map(), new Set()) * prep.yield_amount;
}

function resolve(
  prepId: string,
  idx: LibraryIndex,
  memo: Map<string, number>,
  visiting: Set<string>,
): number {
  const cached = memo.get(prepId);
  if (cached !== undefined) return cached;
  if (visiting.has(prepId)) {
    throw new CostError(`Circular prep reference involving: ${prepId}`, 'cycle');
  }
  const prep = idx.prep(prepId);
  if (!prep) throw new CostError(`Unknown prep: ${prepId}`, 'missing');

  visiting.add(prepId);
  let total = 0;
  for (const line of idx.prepLinesOf(prepId)) {
    if (line.ingredient_id !== null) {
      const ingredient = idx.ingredient(line.ingredient_id);
      if (!ingredient) throw new CostError(`Unknown ingredient: ${line.ingredient_id}`, 'missing');
      total += line.amount * ingredientUnitCost(ingredient);
    } else if (line.component_prep_id !== null) {
      total += line.amount * resolve(line.component_prep_id, idx, memo, visiting);
    }
  }
  visiting.delete(prepId);

  const unitCost = total / prep.yield_amount;
  memo.set(prepId, unitCost);
  return unitCost;
}

/** True if making componentPrepId a component of prepId would close a loop. */
export function wouldCreateCycle(prepId: string, componentPrepId: string, lib: Library): boolean {
  if (prepId === componentPrepId) return true;
  const idx = indexLibrary(lib);
  const stack = [componentPrepId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === prepId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const line of idx.prepLinesOf(current)) {
      if (line.component_prep_id !== null) stack.push(line.component_prep_id);
    }
  }
  return false;
}
