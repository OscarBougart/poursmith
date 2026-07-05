import type { Locale } from '@/data/types';
import { formatEur, formatPercent } from '@/lib/format';
import type { MenuAnalytics } from '@/lib/menuAnalytics';

const HEADER = 'name;price;pour_cost;cost_pct;margin;flag';

function pctCell(fraction: number | null, locale: Locale): string {
  return fraction === null ? '' : formatPercent(fraction, locale);
}

/** Internal menu export as semicolon-delimited CSV, formatted to match the board. */
export function menuCsv(analytics: MenuAnalytics, locale: Locale): string {
  const lines = [HEADER];
  for (const row of analytics.rows) {
    lines.push(
      [
        row.recipe.name,
        row.priceGross === null ? '' : formatEur(row.priceGross, locale),
        formatEur(row.pourCost, locale),
        pctCell(row.costPct, locale),
        row.marginEur === null ? '' : formatEur(row.marginEur, locale),
        row.flag,
      ].join(';'),
    );
  }
  lines.push(`average;;;${pctCell(analytics.avgCostPct, locale)};;`);
  return lines.join('\n');
}
