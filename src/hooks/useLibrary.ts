import { useCallback, useEffect, useState } from 'react';
import type {
  Library,
  NewIngredient,
  NewPrep,
  NewPrepLine,
  NewRecipe,
  NewRecipeLine,
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

type LibraryTable =
  | 'ingredients'
  | 'preps'
  | 'prep_lines'
  | 'recipes'
  | 'recipe_lines'
  | 'menus'
  | 'menu_items';

const ALL_TABLES: LibraryTable[] = [
  'ingredients',
  'preps',
  'prep_lines',
  'recipes',
  'recipe_lines',
  'menus',
  'menu_items',
];

const EMPTY_LIBRARY: Library = {
  ingredients: [],
  preps: [],
  prepLines: [],
  recipes: [],
  recipeLines: [],
  menus: [],
  menuItems: [],
};

function selectTable(table: LibraryTable) {
  switch (table) {
    case 'ingredients':
      return supabase.from('ingredients').select('*').order('name');
    case 'preps':
      return supabase.from('preps').select('*').order('name');
    case 'prep_lines':
      return supabase.from('prep_lines').select('*');
    case 'recipes':
      return supabase.from('recipes').select('*').order('name');
    case 'recipe_lines':
      return supabase.from('recipe_lines').select('*');
    case 'menus':
      return supabase.from('menus').select('*').order('name');
    case 'menu_items':
      return supabase.from('menu_items').select('*');
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function useLibrary(enabled: boolean): UseLibraryResult {
  const [library, setLibrary] = useState<Library>(EMPTY_LIBRARY);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (tables: LibraryTable[] = ALL_TABLES) => {
      if (!enabled) return;
      try {
        const results = await Promise.all(tables.map((table) => selectTable(table)));
        const failed = results.find((r) => r.error);
        if (failed?.error) {
          setError(failed.error.message);
          return;
        }
        setError(null);
        setLibrary((prev) => {
          const next = { ...prev };
          tables.forEach((table, i) => {
            const rows = results[i]?.data ?? [];
            switch (table) {
              case 'ingredients':
                next.ingredients = rows;
                break;
              case 'preps':
                next.preps = rows;
                break;
              case 'prep_lines':
                next.prepLines = rows;
                break;
              case 'recipes':
                next.recipes = rows;
                break;
              case 'recipe_lines':
                next.recipeLines = rows;
                break;
              case 'menus':
                next.menus = rows;
                break;
              case 'menu_items':
                next.menuItems = rows;
                break;
            }
          });
          return next;
        });
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (enabled) {
      setLoading(true);
      void refresh();
    } else {
      setLibrary(EMPTY_LIBRARY);
    }
  }, [enabled, refresh]);

  // Run a write, then refetch only the tables it touched. A thrown operation
  // (e.g. the network dropping) becomes an error message instead of a hang.
  const run = useCallback(
    async (
      operation: () => Promise<string | null>,
      tables: LibraryTable[],
    ): Promise<string | null> => {
      try {
        const message = await operation();
        if (message === null) await refresh(tables);
        return message;
      } catch (e) {
        return errorMessage(e);
      }
    },
    [refresh],
  );

  const addIngredient = useCallback(
    (v: NewIngredient) =>
      run(async () => {
        const { error: e } = await supabase.from('ingredients').insert(v);
        return e ? e.message : null;
      }, ['ingredients']),
    [run],
  );

  const updateIngredient = useCallback(
    (id: string, v: NewIngredient) =>
      run(async () => {
        const { error: e } = await supabase.from('ingredients').update(v).eq('id', id);
        return e ? e.message : null;
      }, ['ingredients']),
    [run],
  );

  const deleteIngredient = useCallback(
    (id: string) =>
      run(async () => {
        const { error: e } = await supabase.from('ingredients').delete().eq('id', id);
        return e ? e.message : null;
      }, ['ingredients']),
    [run],
  );

  const importIngredients = useCallback(
    (rows: NewIngredient[]) =>
      run(async () => {
        const { error: e } = await supabase.from('ingredients').insert(rows);
        return e ? e.message : null;
      }, ['ingredients']),
    [run],
  );

  const savePrep = useCallback(
    (id: string | null, { lines, ...prep }: PrepInput) =>
      run(async () => {
        const { error: e } = await supabase.rpc('save_prep', {
          p_id: id,
          p_name: prep.name,
          p_yield_amount: prep.yield_amount,
          p_yield_unit: prep.yield_unit,
          p_notes: prep.notes,
          p_lines: lines,
        });
        return e ? e.message : null;
      }, ['preps', 'prep_lines']),
    [run],
  );

  const addPrep = useCallback((v: PrepInput) => savePrep(null, v), [savePrep]);
  const updatePrep = useCallback((id: string, v: PrepInput) => savePrep(id, v), [savePrep]);

  const deletePrep = useCallback(
    (id: string) =>
      run(async () => {
        const { error: e } = await supabase.from('preps').delete().eq('id', id);
        return e ? e.message : null;
      }, ['preps', 'prep_lines']),
    [run],
  );

  const saveRecipe = useCallback(
    (id: string | null, { lines, ...recipe }: RecipeInput) =>
      run(async () => {
        const { error: e } = await supabase.rpc('save_recipe', {
          p_id: id,
          p_name: recipe.name,
          p_glass: recipe.glass,
          p_ice: recipe.ice,
          p_method: recipe.method,
          p_price_gross: recipe.price_gross,
          p_target_cost_pct_override: recipe.target_cost_pct_override,
          p_notes: recipe.notes,
          p_description_de: recipe.description_de,
          p_description_en: recipe.description_en,
          p_lines: lines,
        });
        return e ? e.message : null;
      }, ['recipes', 'recipe_lines']),
    [run],
  );

  const addRecipe = useCallback((v: RecipeInput) => saveRecipe(null, v), [saveRecipe]);
  const updateRecipe = useCallback((id: string, v: RecipeInput) => saveRecipe(id, v), [saveRecipe]);

  const deleteRecipe = useCallback(
    (id: string) =>
      run(async () => {
        const { error: e } = await supabase.from('recipes').delete().eq('id', id);
        return e ? e.message : null;
      }, ['recipes', 'recipe_lines']),
    [run],
  );

  const duplicateRecipe = useCallback(
    (id: string, newName: string) =>
      run(async () => {
        const { error: e } = await supabase.rpc('duplicate_recipe', {
          p_source: id,
          p_new_name: newName,
        });
        return e ? e.message : null;
      }, ['recipes', 'recipe_lines']),
    [run],
  );

  const addMenu = useCallback(
    (name: string) =>
      run(async () => {
        const { error: e } = await supabase.from('menus').insert({ name });
        return e ? e.message : null;
      }, ['menus']),
    [run],
  );

  const renameMenu = useCallback(
    (id: string, name: string) =>
      run(async () => {
        const { error: e } = await supabase.from('menus').update({ name }).eq('id', id);
        return e ? e.message : null;
      }, ['menus']),
    [run],
  );

  const deleteMenu = useCallback(
    (id: string) =>
      run(async () => {
        // menu_items cascade on the menu delete.
        const { error: e } = await supabase.from('menus').delete().eq('id', id);
        return e ? e.message : null;
      }, ['menus', 'menu_items']),
    [run],
  );

  const addMenuItem = useCallback(
    (menuId: string, recipeId: string) =>
      run(async () => {
        const orders = library.menuItems
          .filter((i) => i.menu_id === menuId)
          .map((i) => i.sort_order);
        const nextOrder = orders.length === 0 ? 0 : Math.max(...orders) + 1;
        const { error: e } = await supabase
          .from('menu_items')
          .insert({ menu_id: menuId, recipe_id: recipeId, sort_order: nextOrder });
        return e ? e.message : null;
      }, ['menu_items']),
    [run, library],
  );

  const removeMenuItem = useCallback(
    (id: string) =>
      run(async () => {
        const { error: e } = await supabase.from('menu_items').delete().eq('id', id);
        return e ? e.message : null;
      }, ['menu_items']),
    [run],
  );

  const reorderMenuItem = useCallback(
    (id: string, direction: 'up' | 'down') =>
      run(async () => {
        const { error: e } = await supabase.rpc('reorder_menu_item', {
          p_id: id,
          p_direction: direction,
        });
        return e ? e.message : null;
      }, ['menu_items']),
    [run],
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
