import type { Library, Menu, Prep, Recipe } from '@/data/types';

/** Preps that directly use the given ingredient. */
export function ingredientUsedBy(id: string, lib: Library): Prep[] {
  const prepIds = new Set(lib.prepLines.filter((l) => l.ingredient_id === id).map((l) => l.prep_id));
  return lib.preps.filter((p) => prepIds.has(p.id));
}

/** Preps that directly use the given prep as a component. */
export function prepUsedBy(id: string, lib: Library): Prep[] {
  const prepIds = new Set(
    lib.prepLines.filter((l) => l.component_prep_id === id).map((l) => l.prep_id),
  );
  return lib.preps.filter((p) => prepIds.has(p.id));
}

/** Recipes that directly use the given ingredient. */
export function ingredientUsedByRecipes(id: string, lib: Library): Recipe[] {
  const recipeIds = new Set(
    lib.recipeLines.filter((l) => l.ingredient_id === id).map((l) => l.recipe_id),
  );
  return lib.recipes.filter((r) => recipeIds.has(r.id));
}

/** Recipes that directly use the given prep. */
export function prepUsedByRecipes(id: string, lib: Library): Recipe[] {
  const recipeIds = new Set(
    lib.recipeLines.filter((l) => l.component_prep_id === id).map((l) => l.recipe_id),
  );
  return lib.recipes.filter((r) => recipeIds.has(r.id));
}

/** Menus that contain the given recipe. */
export function recipeUsedByMenus(id: string, lib: Library): Menu[] {
  const menuIds = new Set(lib.menuItems.filter((i) => i.recipe_id === id).map((i) => i.menu_id));
  return lib.menus.filter((m) => menuIds.has(m.id));
}
