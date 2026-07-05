export type SortDir = 'asc' | 'desc';

export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

export type SortValue = string | number | null;

/** Header-click cycle: new column → asc, same column → desc, third click → off. */
export function toggleSort<K extends string>(
  current: SortState<K> | null,
  key: K,
): SortState<K> | null {
  if (current === null || current.key !== key) return { key, dir: 'asc' };
  if (current.dir === 'asc') return { key, dir: 'desc' };
  return null;
}

/**
 * Sorted copy of rows by the state's column; the input order is preserved (and
 * the same array returned) when sorting is off. Nulls sort last in both
 * directions; strings compare locale-aware and case-insensitive.
 */
export function sortRows<T, K extends string>(
  rows: T[],
  state: SortState<K> | null,
  value: (row: T, key: K) => SortValue,
): T[] {
  if (state === null) return rows;
  const sign = state.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = value(a, state.key);
    const vb = value(b, state.key);
    if (va === null && vb === null) return 0;
    if (va === null) return 1; // nulls last, direction-independent
    if (vb === null) return -1;
    if (typeof va === 'string' && typeof vb === 'string') {
      return sign * va.localeCompare(vb, undefined, { sensitivity: 'base' });
    }
    return sign * (Number(va) - Number(vb));
  });
}

/** Type guard for sort state read back from localStorage. */
export function isSortStateOf<K extends string>(
  keys: readonly K[],
  candidate: unknown,
): candidate is SortState<K> | null {
  if (candidate === null) return true;
  if (typeof candidate !== 'object') return false;
  const { key, dir } = candidate as { key?: unknown; dir?: unknown };
  return (
    typeof key === 'string' &&
    (keys as readonly string[]).includes(key) &&
    (dir === 'asc' || dir === 'desc')
  );
}
