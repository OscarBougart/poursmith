import { useCallback, useEffect, useState } from 'react';
import type { Library, NewIngredient, NewPrep, NewPrepLine, Prep } from '@/data/types';
import { supabase } from '@/lib/supabase';

export interface PrepInput extends NewPrep {
  lines: NewPrepLine[];
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
}

const EMPTY_LIBRARY: Library = { ingredients: [], preps: [], prepLines: [] };

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

export function useLibrary(enabled: boolean): UseLibraryResult {
  const [library, setLibrary] = useState<Library>(EMPTY_LIBRARY);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const [ingredients, preps, prepLines] = await Promise.all([
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('preps').select('*').order('name'),
      supabase.from('prep_lines').select('*'),
    ]);
    const firstError = ingredients.error ?? preps.error ?? prepLines.error;
    if (firstError) {
      setError(firstError.message);
    } else {
      setError(null);
      setLibrary({
        ingredients: ingredients.data ?? [],
        preps: preps.data ?? [],
        prepLines: prepLines.data ?? [],
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
  };
}
