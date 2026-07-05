import { useCallback } from 'react';
import type { SortState } from '@/lib/tableSort';
import { isSortStateOf, toggleSort } from '@/lib/tableSort';
import { usePersistentState } from '@/hooks/usePersistentState';

export interface TableSort<K extends string> {
  sort: SortState<K> | null;
  toggle: (key: K) => void;
}

/** Column sort state for one table, persisted so the choice survives reloads. */
export function useTableSort<K extends string>(
  storageKey: string,
  keys: readonly K[],
): TableSort<K> {
  const [sort, setSort] = usePersistentState<SortState<K> | null>(
    storageKey,
    null,
    (candidate): candidate is SortState<K> | null => isSortStateOf(keys, candidate),
  );
  const toggle = useCallback((key: K) => setSort((s) => toggleSort(s, key)), [setSort]);
  return { sort, toggle };
}
