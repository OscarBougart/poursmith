import type { ReactElement } from 'react';
import type { Library, Menu, Settings } from '@/data/types';
import { formatEur, formatPercent } from '@/lib/format';
import { menuAnalytics, worstOffenderName } from '@/lib/menuAnalytics';
import { useLocale, useT } from '@/i18n';

export interface InternalMenuViewProps {
  menu: Menu;
  library: Library;
  settings: Settings;
}

/** Print-only internal costing sheet: full board table plus analytics. */
export default function InternalMenuView({
  menu,
  library,
  settings,
}: InternalMenuViewProps): ReactElement {
  const t = useT();
  const { locale } = useLocale();
  const analytics = menuAnalytics(menu.id, library, settings);
  const worstName = worstOffenderName(analytics, library, t('menu.none'));

  return (
    <div className="print-area hidden print:block">
      <h1 className="mb-4 text-2xl font-semibold">{menu.name}</h1>
      <table className="mb-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-400">
            <th className="py-2 pr-3">{t('menu.drink')}</th>
            <th className="py-2 pr-3">{t('recipe.priceGross')}</th>
            <th className="py-2 pr-3">{t('recipe.pourCost')}</th>
            <th className="py-2 pr-3">{t('recipe.costPct')}</th>
            <th className="py-2 pr-3">{t('recipe.margin')}</th>
            <th className="py-2">{t('menu.flag')}</th>
          </tr>
        </thead>
        <tbody>
          {analytics.rows.map((row) => (
            <tr key={row.recipe.id} className="border-b border-gray-200">
              <td className="py-2 pr-3">{row.recipe.name}</td>
              <td className="py-2 pr-3">
                {row.priceGross !== null ? formatEur(row.priceGross, locale) : t('menu.unpriced')}
              </td>
              <td className="py-2 pr-3">{formatEur(row.pourCost, locale)}</td>
              <td className="py-2 pr-3">
                {row.costPct !== null ? formatPercent(row.costPct, locale) : '—'}
              </td>
              <td className="py-2 pr-3">
                {row.marginEur !== null ? formatEur(row.marginEur, locale) : '—'}
              </td>
              <td className="py-2">
                {row.flag === 'unpriced' ? t('menu.unpriced') : t(`flag.${row.flag}`)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="grid max-w-md grid-cols-2 gap-y-1 text-sm">
        <dt>{t('menu.avgCostPct')}</dt>
        <dd className="text-right">
          {analytics.avgCostPct !== null ? formatPercent(analytics.avgCostPct, locale) : t('menu.none')}
        </dd>
        <dt>{t('menu.marginSpread')}</dt>
        <dd className="text-right">
          {analytics.marginSpread !== null
            ? `${formatEur(analytics.marginSpread.min, locale)} – ${formatEur(analytics.marginSpread.max, locale)}`
            : t('menu.none')}
        </dd>
        <dt>{t('menu.worstOffender')}</dt>
        <dd className="text-right">{worstName}</dd>
      </dl>
    </div>
  );
}
