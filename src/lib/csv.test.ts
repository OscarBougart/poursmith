import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, ingredientCsvTemplate, parseIngredientCsv } from '@/lib/csv';

const HEADER = CSV_COLUMNS.join(';');

describe('ingredientCsvTemplate', () => {
  it('starts with the exact header row', () => {
    expect(ingredientCsvTemplate().split('\n')[0]).toBe(HEADER);
  });
  it('round-trips through the parser', () => {
    const result = parseIngredientCsv(ingredientCsvTemplate(), []);
    expect(result.errors).toEqual([]);
    expect(result.valid.length).toBeGreaterThan(0);
  });
});

describe('parseIngredientCsv', () => {
  it('parses semicolon-delimited rows with decimal commas', () => {
    const text = [HEADER, 'Campari;liqueur;700;ml;14,99;19;0', 'Limetten;produce;1;piece;0,49;7;'].join('\n');
    const result = parseIngredientCsv(text, []);
    expect(result.errors).toEqual([]);
    expect(result.totalRows).toBe(2);
    expect(result.valid).toEqual([
      { name: 'Campari', category: 'liqueur', pack_size: 700, unit: 'ml', price_gross: 14.99, vat_rate: 0.19, waste_pct: 0 },
      { name: 'Limetten', category: 'produce', pack_size: 1, unit: 'piece', price_gross: 0.49, vat_rate: 0.07, waste_pct: 0 },
    ]);
  });

  it('parses comma-delimited rows with point decimals', () => {
    const text = [CSV_COLUMNS.join(','), 'Aperol,liqueur,700,ml,12.99,0.19,0'].join('\n');
    const result = parseIngredientCsv(text, []);
    expect(result.errors).toEqual([]);
    expect(result.valid[0]?.price_gross).toBe(12.99);
  });

  it('rejects a wrong header outright', () => {
    const result = parseIngredientCsv('foo;bar\nCampari;liqueur', []);
    expect(result.valid).toEqual([]);
    expect(result.errors).toEqual([{ row: 1, field: 'header', key: 'csv.error.header' }]);
  });

  it('strips a BOM and skips blank lines', () => {
    const text = `﻿${HEADER}\n\nCampari;liqueur;700;ml;14,99;19;0\n\n`;
    const result = parseIngredientCsv(text, []);
    expect(result.errors).toEqual([]);
    expect(result.totalRows).toBe(1);
  });

  it('flags duplicate names within the file', () => {
    const text = [HEADER, 'Campari;liqueur;700;ml;14,99;19;0', 'campari;liqueur;700;ml;14,99;19;0'].join('\n');
    const result = parseIngredientCsv(text, []);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toEqual([{ row: 3, field: 'name', key: 'csv.error.name.duplicate' }]);
  });

  it('flags duplicates against the existing library case-insensitively', () => {
    const text = [HEADER, 'CAMPARI;liqueur;700;ml;14,99;19;0'].join('\n');
    const result = parseIngredientCsv(text, ['Campari']);
    expect(result.valid).toEqual([]);
    expect(result.errors).toEqual([{ row: 2, field: 'name', key: 'csv.error.name.duplicate' }]);
  });

  it('flags missing name, bad category, bad unit, bad numbers, bad vat and bad waste', () => {
    const text = [
      HEADER,
      ';liqueur;700;ml;14,99;19;0',
      'A;wine;700;ml;14,99;19;0',
      'B;liqueur;700;l;14,99;19;0',
      'C;liqueur;abc;ml;14,99;19;0',
      'D;liqueur;700;ml;14,99;5;0',
      'E;liqueur;700;ml;14,99;19;150',
    ].join('\n');
    const result = parseIngredientCsv(text, []);
    expect(result.valid).toEqual([]);
    expect(result.errors).toEqual([
      { row: 2, field: 'name', key: 'csv.error.name.required' },
      { row: 3, field: 'category', key: 'csv.error.category' },
      { row: 4, field: 'unit', key: 'csv.error.unit' },
      { row: 5, field: 'pack_size', key: 'csv.error.number' },
      { row: 6, field: 'vat_rate', key: 'csv.error.vat' },
      { row: 7, field: 'waste_pct', key: 'csv.error.waste' },
    ]);
  });

  it('accepts vat as percent integer', () => {
    const text = [HEADER, 'F;juice;1000;ml;2,49;7;0'].join('\n');
    expect(parseIngredientCsv(text, []).valid[0]?.vat_rate).toBe(0.07);
  });
});
