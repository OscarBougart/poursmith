import { describe, expect, it } from 'vitest';
import { de } from '@/i18n/de';
import { en } from '@/i18n/en';
import { translate } from '@/i18n';

describe('message catalogs', () => {
  it('have identical key sets', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
  });
  it('have no empty strings', () => {
    for (const catalog of [de, en]) {
      for (const [key, value] of Object.entries(catalog)) {
        expect(value, key).not.toBe('');
      }
    }
  });
});

describe('translate', () => {
  it('interpolates {vars}', () => {
    expect(translate('en', 'csv.rowsFound', { n: 12 })).toBe('12 rows read');
    expect(translate('de', 'csv.row', { row: 3 })).toBe('Zeile 3');
  });
  it('leaves unknown placeholders literal', () => {
    expect(translate('en', 'csv.rowsFound', { other: 1 })).toBe('{n} rows read');
  });
});
