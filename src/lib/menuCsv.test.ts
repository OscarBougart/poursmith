import { describe, expect, it } from 'vitest';
import type { MenuAnalytics, MenuRow } from '@/lib/menuAnalytics';
import { menuCsv } from '@/lib/menuCsv';
import { formatEur, formatPercent } from '@/lib/format';

function row(over: Partial<MenuRow> & { id: string }): MenuRow {
  return {
    recipe: {
      id: over.id,
      name: over.id,
      glass: null,
      ice: null,
      method: 'shaken',
      price_gross: over.priceGross ?? null,
      target_cost_pct_override: null,
      notes: null,
      description_de: null,
      description_en: null,
      created_at: '',
      updated_at: '',
    },
    pourCost: 0,
    priceGross: null,
    costPct: null,
    marginEur: null,
    flag: 'unpriced',
    ...over,
  };
}

describe('menuCsv', () => {
  const priced = row({
    id: 'Negroni',
    pourCost: 1.5,
    priceGross: 12,
    costPct: 0.1488,
    marginEur: 8.58,
    flag: 'green',
  });
  const unpriced = row({ id: 'Special', pourCost: 2.0, flag: 'unpriced' });
  const analytics: MenuAnalytics = {
    rows: [priced, unpriced],
    avgCostPct: 0.1488,
    marginSpread: { min: 8.58, max: 8.58 },
    worstOffenderId: 'Negroni',
  };

  it('emits the exact header', () => {
    const lines = menuCsv(analytics, 'de').split('\n');
    expect(lines[0]).toBe('name;price;pour_cost;cost_pct;margin;flag');
  });

  it('formats a priced row like the screen', () => {
    const lines = menuCsv(analytics, 'de').split('\n');
    expect(lines[1]).toBe(
      [
        'Negroni',
        formatEur(12, 'de'),
        formatEur(1.5, 'de'),
        formatPercent(0.1488, 'de'),
        formatEur(8.58, 'de'),
        'green',
      ].join(';'),
    );
  });

  it('leaves cost cells empty for an unpriced row', () => {
    const lines = menuCsv(analytics, 'de').split('\n');
    expect(lines[2]).toBe(['Special', '', formatEur(2, 'de'), '', '', 'unpriced'].join(';'));
  });

  it('ends with an average line reflecting priced drinks', () => {
    const lines = menuCsv(analytics, 'de').split('\n');
    expect(lines[3]).toBe(`average;;;${formatPercent(0.1488, 'de')};;`);
  });
});
