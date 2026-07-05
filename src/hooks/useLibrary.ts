import { useCallback, useEffect, useState } from 'react';
import type {
  Library,
  Menu,
  NewIngredient,
  NewPrep,
  NewPrepLine,
  NewRecipe,
  NewRecipeLine,
  Prep,
  Recipe,
} from '@/data/types';
import { supabase } from '@/lib/supabase';

export interface PrepInput extends NewPrep {
  lines: NewPrepLine[];
}

export interface RecipeInput extends NewRecipe {
  lines: NewRecipeLine[];
}

export interface UseLibraryResult {
  library: Library;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addIngredient: (v: NewIngredient) => Promise<string | null>;
  updateIngredient: (id: string, v: NewIngredient) => Promise<string | null>;
  deleteIngredient: (id: string) => Promise<string | null>;
  addPrep: (v: PrepInput) => Promise<string | null>;
  updatePrep: (id: string, v: PrepInput) => Promise<string | null>;
  deletePrep: (id: string) => Promise<string | null>;
  importIngredients: (rows: NewIngredient[]) => Promise<string | null>;
  addRecipe: (v: RecipeInput) => Promise<string | null>;
  updateRecipe: (id: string, v: RecipeInput) => Promise<string | null>;
  deleteRecipe: (id: string) => Promise<string | null>;
  duplicateRecipe: (id: string, newName: string) => Promise<string | null>;
  addMenu: (name: string) => Promise<string | null>;
  renameMenu: (id: string, name: string) => Promise<string | null>;
  deleteMenu: (id: string) => Promise<string | null>;
  addMenuItem: (menuId: string, recipeId: string) => Promise<string | null>;
  removeMenuItem: (id: string) => Promise<string | null>;
  reorderMenuItem: (id: string, direction: 'up' | 'down') => Promise<string | null>;
}

const EMPTY_LIBRARY: Library = {
  ingredients: [],
  preps: [],
  prepLines: [],
  recipes: [],
  recipeLines: [],
  menus: [],
  menuItems: [],
};

/** Preps that directly use the given ingredient. */
export function ingredientUsedBy(id: string, lib: Library): Prep[] {
  const prepIds = new Set(
    lib.prepLines.filter((l) => l.ingredient_id === id).map((l) => l.prep_id),
  );
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
  const menuIds = new Set(
    lib.menuItems.filter((i) => i.recipe_id === id).map((i) => i.menu_id),
  );
  return lib.menus.filter((m) => menuIds.has(m.id));
}

export function useLibrary(enabled: boolean): UseLibraryResult {
  const [library, setLibrary] = useState<Library>(EMPTY_LIBRARY);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const [ingredients, preps, prepLines, recipes, recipeLines, menus, menuItems] =
      await Promise.all([
        supabase.from('ingredients').select('*').order('name'),
        supabase.from('preps').select('*').order('name'),
        supabase.from('prep_lines').select('*'),
        supabase.from('recipes').select('*').order('name'),
        supabase.from('recipe_lines').select('*'),
        supabase.from('menus').select('*').order('name'),
        supabase.from('menu_items').select('*'),
      ]);
    const firstError =
      ingredients.error ??
      preps.error ??
      prepLines.error ??
      recipes.error ??
      recipeLines.error ??
      menus.error ??
      menuItems.error;
    if (firstError) {
      setError(firstError.message);
    } else {
      setError(null);
      setLibrary({
        ingredients: ingredients.data ?? [],
        preps: preps.data ?? [],
        prepLines: prepLines.data ?? [],
        recipes: recipes.data ?? [],
        recipeLines: recipeLines.data ?? [],
        menus: menus.data ?? [],
        menuItems: menuItems.data ?? [],
      });
    }
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      setLoading(true);
      void refresh();
    } else {
      setLibrary(EMPTY_LIBRARY);
    }
  }, [enabled, refresh]);

  const run = useCallback(
    async (operation: () => Promise<string | null>): Promise<string | null> => {
      const message = await operation();
      if (message === null) await refresh();
      return message;
    },
    [refresh],
  );

  const addIngredient = useCallback(
    (v: NewIngredient) =>
      run(async () => {
        const { error: e } = await supabase.from('ingredients').insert(v);
        return e ? e.message : null;
      }),
    [run],
  );

  const updateIngredient = useCallback(
    (id: string, v: NewIngredient) =>
      run(async () => {
        const { error: e } = await supabase.from('ingredients').update(v).eq('id', id);
        return e ? e.message : null;
      }),
    [run],
  );

  const deleteIngredient = useCallback(
    (id: string) =>
      run(async () => {
        const { error: e } = await supabase.from('ingredients').delete().eq('id', id);
        return e ? e.message : null;
      }),
    [run],
  );

  const addPrep = useCallback(
    ({ lines, ...prep }: PrepInput) =>
      run(async () => {
        const { data, error: e } = await supabase.from('preps').insert(prep).select('id').single();
        if (e) return e.message;
        const withPrepId = lines.map((l) => ({ ...l, prep_id: (data as { id: string }).id }));
        const { error: lineError } = await supabase.from('prep_lines').insert(withPrepId);
        return lineError ? lineError.message : null;
      }),
    [run],
  );

  const updatePrep = useCallback(
    (id: string, { lines, ...prep }: PrepInput) =>
      run(async () => {
        const { error: e } = await supabase.from('preps').update(prep).eq('id', id);
        if (e) return e.message;
        const { error: deleteError } = await supabase.from('prep_lines').delete().eq('prep_id', id);
        if (deleteError) return deleteError.message;
        const withPrepId = lines.map((l) => ({ ...l, prep_id: id }));
        const { error: lineError } = await supabase.from('prep_lines').insert(withPrepId);
        return lineError ? lineError.message : null;
      }),
    [run],
  );

  const deletePrep = useCallback(
    (id: string) =>
      run(async () => {
        const { error: lineError } = await supabase.from('prep_lines').delete().eq('prep_id', id);
        if (lineError) return lineError.message;
        const { error: e } = await supabase.from('preps').delete().eq('id', id);
        return e ? e.message : null;
      }),
    [run],
  );

  const importIngredients = useCallback(
    (rows: NewIngredient[]) =>
      run(async () => {
        const { error: e } = await supabase.from('ingredients').insert(rows);
        return e ? e.message : null;
      }),
    [run],
  );

  const addRecipe = useCallback(
    ({ lines, ...recipe }: RecipeInput) =>
      run(async () => {
        const { data, error: e } = await supabase.from('recipes').insert(recipe).select('id').single();
        if (e) return e.message;
        const withRecipeId = lines.map((l) => ({ ...l, recipe_id: (data as { id: string }).id }));
        const { error: lineError } = await supabase.from('recipe_lines').insert(withRecipeId);
        return lineError ? lineError.message : null;
      }),
    [run],
  );

  const updateRecipe = useCallback(
    (id: string, { lines, ...recipe }: RecipeInput) =>
      run(async () => {
        const { error: e } = await supabase.from('recipes').update(recipe).eq('id', id);
        if (e) return e.message;
        const { error: deleteError } = await supabase.from('recipe_lines').delete().eq('recipe_id', id);
        if (deleteError) return deleteError.message;
        const withRecipeId = lines.map((l) => ({ ...l, recipe_id: id }));
        const { error: lineError } = await supabase.from('recipe_lines').insert(withRecipeId);
        return lineError ? lineError.message : null;
      }),
    [run],
  );

  const deleteRecipe = useCallback(
    (id: string) =>
      run(async () => {
        const { error: lineError } = await supabase.from('recipe_lines').delete().eq('recipe_id', id);
        if (lineError) return lineError.message;
        const { error: e } = await supabase.from('recipes').delete().eq('id', id);
        return e ? e.message : null;
      }),
    [run],
  );

  const duplicateRecipe = useCallback(
    (id: string, newName: string) =>
      run(async () => {
        const source = library.recipes.find((r) => r.id === id);
        if (!source) return 'recipe not found';
        const { id: _id, created_at: _c, updated_at: _u, ...fields } = source;
        const { data, error: e } = await supabase
          .from('recipes')
          .insert({ ...fields, name: newName })
          .select('id')
          .single();
        if (e) return e.message;
        const copies = library.recipeLines
          .filter((l) => l.recipe_id === id)
          .map(({ id: _lid, recipe_id: _rid, ...line }) => ({
            ...line,
            recipe_id: (data as { id: string }).id,
          }));
        if (copies.length === 0) return null;
        const { error: lineError } = await supabase.from('recipe_lines').insert(copies);
        return lineError ? lineError.message : null;
      }),
    [run, library],
  );

  const addMenu = useCallback(
    (name: string) =>
      run(async () => {
        const { error: e } = await supabase.from('menus').insert({ name });
        return e ? e.message : null;
      }),
    [run],
  );

  const renameMenu = useCallback(
    (id: string, name: string) =>
      run(async () => {
        const { error: e } = await supabase.from('menus').update({ name }).eq('id', id);
        return e ? e.message : null;
      }),
    [run],
  );

  const deleteMenu = useCallback(
    (id: string) =>
      run(async () => {
        const { error: itemError } = await supabase.from('menu_items').delete().eq('menu_id', id);
        if (itemError) return itemError.message;
        const { error: e } = await supabase.from('menus').delete().eq('id', id);
        return e ? e.message : null;
      }),
    [run],
  );

  const addMenuItem = useCallback(
    (menuId: string, recipeId: string) =>
      run(async () => {
        const existing = library.menuItems.filter((i) => i.menu_id === menuId);
        const nextOrder = existing.reduce((max, i) => Math.max(max, i.sort_order), -1) + 1;
        const { error: e } = await supabase
          .from('menu_items')
          .insert({ menu_id: menuId, recipe_id: recipeId, sort_order: nextOrder });
        return e ? e.message : null;
      }),
    [run, library],
  );

  const removeMenuItem = useCallback(
    (id: string) =>
      run(async () => {
        const { error: e } = await supabase.from('menu_items').delete().eq('id', id);
        return e ? e.message : null;
      }),
    [run],
  );

  const reorderMenuItem = useCallback(
    (id: string, direction: 'up' | 'down') =>
      run(async () => {
        const item = library.menuItems.find((i) => i.id === id);
        if (!item) return 'menu item not found';
        const siblings = library.menuItems
          .filter((i) => i.menu_id === item.menu_id)
          .sort((a, b) => a.sort_order - b.sort_order);
        const index = siblings.findIndex((i) => i.id === id);
        const neighbourIndex = direction === 'up' ? index - 1 : index + 1;
        const neighbour = siblings[neighbourIndex];
        if (!neighbour) return null; // already at an edge
        const first = await supabase
          .from('menu_items')
          .update({ sort_order: neighbour.sort_order })
          .eq('id', item.id);
        if (first.error) return first.error.message;
        const second = await supabase
          .from('menu_items')
          .update({ sort_order: item.sort_order })
          .eq('id', neighbour.id);
        return second.error ? second.error.message : null;
      }),
    [run, library],
  );

  return {
    library,
    loading,
    error,
    refresh,
    addIngredient,
    updateIngredient,
    deleteIngredient,
    addPrep,
    updatePrep,
    deletePrep,
    importIngredients,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    duplicateRecipe,
    addMenu,
    renameMenu,
    deleteMenu,
    addMenuItem,
    removeMenuItem,
    reorderMenuItem,
  };
}
