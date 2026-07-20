import { useMemo } from 'react';
import type { ReactElement } from 'react';
import type { Library, Settings } from '@/data/types';
import { costPct, effectiveTargetPct, grossMarginEur } from '@/lib/pricing';
import type { RagFlag } from '@/lib/menuAnalytics';
import { ragFlag } from '@/lib/menuAnalytics';
import { recipePourCost } from '@/lib/recipeCost';
import { formatEur, formatPercent } from '@/lib/format';
import { FLAG_DOT } from '@/components/flagColors';
import { useLocale, useT } from '@/i18n';

export interface RecipeSummaryProps {
  library: Library;
  settings: Settings;
}

// Order matters: the meter reads healthy → underwater → unpriced, left to right.
const SEGMENTS: RagFlag[] = ['green', 'amber', 'red', 'unpriced'];

/**
 * The one-glance health read for the whole recipe book: a segmented meter of
 * green/amber/red/unpriced drinks plus the headline figures. It surfaces the
 * app's core value — profitability made visible — above the detail table.
 */
export default function RecipeSummary({ library, settings }: RecipeSummaryProps): ReactElement | null {
  const t = useT();
  const { locale } = useLocale();

  const stats = useMemo(() => {
    const counts: Record<RagFlag, number> = { green: 0, amber: 0, red: 0, unpriced: 0 };
    let costSum = 0;
    let pricedCount = 0;
    let bestMargin: number | null = null;
    for (const recipe of library.recipes) {
      let pourCost: number | null;
      try {
        pourCost = recipePourCost(recipe.id, library);
      } catch {
        pourCost = null;
      }
      const pct = pourCost !== null ? costPct(pourCost, recipe.price_gross) : null;
      const flag = ragFlag(pct, effectiveTargetPct(recipe.target_cost_pct_override, settings));
      counts[flag] += 1;
      if (pct !== null) {
        costSum += pct;
        pricedCount += 1;
      }
      const margin = pourCost !== null ? grossMarginEur(pourCost, recipe.price_gross) : null;
      if (margin !== null && (bestMargin === null || margin > bestMargin)) bestMargin = margin;
    }
    return {
      total: library.recipes.length,
      counts,
      pricedCount,
      avgCostPct: pricedCount === 0 ? null : costSum / pricedCount,
      attention: counts.amber + counts.red,
      bestMargin,
    };
  }, [library, settings]);

  if (stats.total === 0) return null;

  return (
    <section
      aria-label={t('summary.label')}
      className="mb-5 rounded-xl border border-border bg-bg-card/50 px-4 py-3.5"
    >
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-bg-elevated" aria-hidden="true">
        {SEGMENTS.map((flag) => {
          const n = stats.counts[flag];
          if (n === 0) return null;
          return (
            <span
              key={flag}
              className={`${FLAG_DOT[flag]} first:rounded-l-full last:rounded-r-full`}
              style={{ width: `${(n / stats.total) * 100}%` }}
            />
          );
        })}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-text-secondary">
        <span className="font-medium text-text-primary">
          {t('summary.count', { priced: stats.pricedCount, total: stats.total })}
        </span>
        {stats.avgCostPct !== null && (
          <span>{t('summary.avgCost', { pct: formatPercent(stats.avgCostPct, locale) })}</span>
        )}
        <span className={stats.attention > 0 ? 'text-warning' : 'text-margin-good'}>
          {stats.attention > 0
            ? t('summary.attention', { n: stats.attention })
            : t('summary.allHealthy')}
        </span>
        {stats.bestMargin !== null && (
          <span>{t('summary.bestMargin', { value: formatEur(stats.bestMargin, locale) })}</span>
        )}
      </p>
    </section>
  );
}
