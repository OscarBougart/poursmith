import type { Category, NewIngredient, Unit } from '@/data/types';
import { CATEGORIES, UNITS } from '@/data/types';
import { parseDecimal, parseVatRate } from '@/lib/parse';

export const CSV_COLUMNS = [
  'name',
  'category',
  'pack_size',
  'unit',
  'price_gross',
  'vat_rate',
  'waste_pct',
] as const;

export type CsvErrorKey =
  | 'csv.error.header'
  | 'csv.error.name.required'
  | 'csv.error.name.duplicate'
  | 'csv.error.category'
  | 'csv.error.unit'
  | 'csv.error.number'
  | 'csv.error.vat'
  | 'csv.error.waste';

export interface CsvRowError {
  row: number;
  field: string;
  key: CsvErrorKey;
}

export interface CsvParseResult {
  valid: NewIngredient[];
  errors: CsvRowError[];
  totalRows: number;
}

export function ingredientCsvTemplate(): string {
  return [
    CSV_COLUMNS.join(';'),
    'Tanqueray London Dry Gin;spirit;700;ml;18,99;19;0',
    'Limetten;produce;1;piece;0,49;7;0',
  ].join('\n');
}

export function parseIngredientCsv(text: string, existingNames: string[]): CsvParseResult {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\n/);
  const headerLine = lines[0] ?? '';
  const delimiter = headerLine.includes(';') ? ';' : ',';
  const header = headerLine.split(delimiter).map((h) => h.trim().toLowerCase());
  if (header.join('|') !== CSV_COLUMNS.join('|')) {
    return {
      valid: [],
      errors: [{ row: 1, field: 'header', key: 'csv.error.header' }],
      totalRows: 0,
    };
  }

  const taken = new Set(existingNames.map((n) => n.toLowerCase()));
  const valid: NewIngredient[] = [];
  const errors: CsvRowError[] = [];
  let totalRows = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const raw = lines[i];
    if (raw === undefined || raw.trim() === '') continue;
    totalRows += 1;
    const row = i + 1;
    const cells = raw.split(delimiter).map((c) => c.trim());
    const rowErrors: CsvRowError[] = [];

    const name = cells[0] ?? '';
    if (name === '') {
      rowErrors.push({ row, field: 'name', key: 'csv.error.name.required' });
    } else if (taken.has(name.toLowerCase())) {
      rowErrors.push({ row, field: 'name', key: 'csv.error.name.duplicate' });
    }

    const category = (cells[1] ?? '') as Category;
    if (!(CATEGORIES as readonly string[]).includes(category)) {
      rowErrors.push({ row, field: 'category', key: 'csv.error.category' });
    }

    const packSize = parseDecimal(cells[2] ?? '');
    if (packSize === null || packSize <= 0) {
      rowErrors.push({ row, field: 'pack_size', key: 'csv.error.number' });
    }

    const unit = (cells[3] ?? '') as Unit;
    if (!(UNITS as readonly string[]).includes(unit)) {
      rowErrors.push({ row, field: 'unit', key: 'csv.error.unit' });
    }

    const priceGross = parseDecimal(cells[4] ?? '');
    if (priceGross === null || priceGross < 0) {
      rowErrors.push({ row, field: 'price_gross', key: 'csv.error.number' });
    }

    const vatRate = parseVatRate(cells[5] ?? '');
    if (vatRate === null) {
      rowErrors.push({ row, field: 'vat_rate', key: 'csv.error.vat' });
    }

    const wasteRaw = cells[6] ?? '';
    const wastePct = wasteRaw === '' ? 0 : parseDecimal(wasteRaw);
    if (wastePct === null || wastePct < 0 || wastePct >= 100) {
      rowErrors.push({ row, field: 'waste_pct', key: 'csv.error.waste' });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }
    taken.add(name.toLowerCase());
    valid.push({
      name,
      category,
      pack_size: packSize as number,
      unit,
      price_gross: priceGross as number,
      vat_rate: vatRate as number,
      waste_pct: wastePct as number,
    });
  }

  return { valid, errors, totalRows };
}
