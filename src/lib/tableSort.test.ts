import { describe, expect, it } from 'vitest';
import type { SortState } from '@/lib/tableSort';
import { sortRows, toggleSort } from '@/lib/tableSort';

type Key = 'name' | 'price';

interface Row {
  name: string;
  price: number | null;
}

const rows: Row[] = [
  { name: 'Mojito', price: 11 },
  { name: 'Ändere', price: null }, // umlaut: locale-aware compare puts it near A
  { name: 'Daiquiri', price: 13 },
  { name: 'negroni', price: 12 }, // lowercase: case-insensitive compare
];

function value(row: Row, key: Key): string | number | null {
  return key === 'name' ? row.name : row.price;
}

describe('toggleSort', () => {
  it('cycles asc → desc → off for the same column', () => {
    const asc = toggleSort<Key>(null, 'name');
    expect(asc).toEqual({ key: 'name', dir: 'asc' });
    const desc = toggleSort(asc, 'name');
    expect(desc).toEqual({ key: 'name', dir: 'desc' });
    expect(toggleSort(desc, 'name')).toBeNull();
  });

  it('switching column starts ascending', () => {
    expect(toggleSort<Key>({ key: 'name', dir: 'desc' }, 'price')).toEqual({
      key: 'price',
      dir: 'asc',
    });
  });
});

describe('sortRows', () => {
  it('returns the original array untouched when sort is off', () => {
    expect(sortRows(rows, null, value)).toBe(rows);
  });

  it('sorts strings locale-aware and case-insensitive', () => {
    const names = sortRows(rows, { key: 'name', dir: 'asc' }, value).map((r) => r.name);
    expect(names).toEqual(['Ändere', 'Daiquiri', 'Mojito', 'negroni']);
  });

  it('sorts numbers descending', () => {
    const prices = sortRows(rows, { key: 'price', dir: 'desc' }, value).map((r) => r.price);
    expect(prices).toEqual([13, 12, 11, null]);
  });

  it('keeps nulls last in both directions', () => {
    const asc = sortRows(rows, { key: 'price', dir: 'asc' }, value).map((r) => r.price);
    expect(asc).toEqual([11, 12, 13, null]);
  });

  it('does not mutate the input', () => {
    sortRows(rows, { key: 'name', dir: 'asc' }, value);
    expect(rows[0]?.name).toBe('Mojito');
  });

  it('validates persisted state', () => {
    expect(isSortStateOf(['name', 'price'], { key: 'name', dir: 'asc' })).toBe(true);
    expect(isSortStateOf(['name', 'price'], { key: 'bogus', dir: 'asc' })).toBe(false);
    expect(isSortStateOf(['name', 'price'], { key: 'name', dir: 'up' })).toBe(false);
    expect(isSortStateOf(['name', 'price'], null)).toBe(true);
    expect(isSortStateOf(['name', 'price'], 'junk')).toBe(false);
  });
});

// imported lazily so the failing-test phase names the missing export clearly
import { isSortStateOf } from '@/lib/tableSort';
const _typecheck: SortState<Key> = { key: 'name', dir: 'asc' };
void _typecheck;
