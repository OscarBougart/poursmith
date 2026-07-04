import type { Library, NewRecipeLine } from '@/data/types';
import { CostError, ingredientUnitCost, prepUnitCost } from '@/lib/cost';
import { convertAmount } from '@/lib/units';

/** Cost of one recipe line, converting the line unit to the component's native unit. */
export function recipeLineCost(line: NewRecipeLine, lib: Library): number {
  if (line.ingredient_id !== null) {
    const ingredient = lib.ingredients.find((i) => i.id === line.ingredient_id);
    if (!ingredient) throw new CostError(`Unknown ingredient: ${line.ingredient_id}`, 'missing');
    return convertAmount(line.amount, line.unit, ingredient.unit) * ingredientUnitCost(ingredient);
  }
  if (line.component_prep_id !== null) {
    const prep = lib.preps.find((p) => p.id === line.component_prep_id);
    if (!prep) throw new CostError(`Unknown prep: ${line.component_prep_id}`, 'missing');
    return convertAmount(line.amount, line.unit, prep.yield_unit) * prepUnitCost(prep.id, lib);
  }
  throw new CostError('Recipe line has no component', 'missing');
}

/** Total pour cost of a recipe, garnish lines included. */
export function recipePourCost(recipeId: string, lib: Library): number {
  const recipe = lib.recipes.find((r) => r.id === recipeId);
  if (!recipe) throw new CostError(`Unknown recipe: ${recipeId}`, 'missing');
  let total = 0;
  for (const line of lib.recipeLines) {
    if (line.recipe_id === recipeId) total += recipeLineCost(line, lib);
  }
  return total;
}
