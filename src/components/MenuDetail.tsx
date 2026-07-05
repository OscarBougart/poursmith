import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { Library, Locale, Menu, Settings } from '@/data/types';
import { formatEur, formatPercent } from '@/lib/format';
import { menuAnalytics, worstOffenderName } from '@/lib/menuAnalytics';
import { sortRows } from '@/lib/tableSort';
import { useTableSort } from '@/hooks/useTableSort';
import { useLocale, useT } from '@/i18n';
import { ICON_BUTTON, ICON_BUTTON_DANGER } from '@/components/buttonStyles';
import { FLAG_DOT, FLAG_ROW_TINT, FLAG_TEXT } from '@/components/flagColors';
import SortHeader from '@/components/SortHeader';

export interface MenuDetailProps {
  menu: Menu;
  library: Library;
  settings: Settings;
  onAddItem: (recipeId: string) => Promise<string | null>;
  onRemoveItem: (id: string) => Promise<string | null>;
  onReorder: (id: string, direction: 'up' | 'down') => Promise<string | null>;
  onExportGuest: (language: Locale) => void;
  onExportInternal: () => void;
  onExportCsv: () => void;
}

const SORT_KEYS = ['price', 'pourCost', 'costPct', 'margin'] as const;
type SortKey = (typeof SORT_KEYS)[number];

export default function MenuDetail({
  menu,
  library,
  settings,
  onAddItem,
  onRemoveItem,
  onReorder,
  onExportGuest,
  onExportInternal,
  onExportCsv,
}: MenuDetailProps): ReactElement {
  const t = useT();
  const { locale } = useLocale();
  const { sort, toggle } = useTableSort<SortKey>('poursmith.sort.menuBoard', SORT_KEYS);
  const [guestLang, setGuestLang] = useState<Locale>(locale);

  const analytics = useMemo(
    () => menuAnalytics(menu.id, library, settings),
    [menu.id, library, settings],
  );

  const itemByRecipe = useMemo(() => {
    const map = new Map<string, string>(); // recipeId → menuItem id
    for (const item of library.menuItems) {
      if (item.menu_id === menu.id) map.set(item.recipe_id, item.id);
    }
    return map;
  }, [library.menuItems, menu.id]);

  // Sorting off = the menu's own order (and the only mode where reordering makes sense).
  const sortedRows = useMemo(
    () =>
      sortRows(analytics.rows, sort, (row, key) => {
        switch (key) {
          case 'price':
            return row.priceGross;
          case 'pourCost':
            return row.pourCost;
          case 'costPct':
            return row.costPct;
          case 'margin':
            return row.marginEur;
        }
      }),
    [analytics.rows, sort],
  );

  const availableRecipes = useMemo(
    () => library.recipes.filter((r) => !itemByRecipe.has(r.id)),
    [library.recipes, itemByRecipe],
  );

  const worstName = worstOffenderName(analytics, library, t('menu.none'));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-50">{menu.name}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={guestLang}
            onChange={(e) => setGuestLang(e.target.value as Locale)}
            aria-label={t('menu.language')}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-accent"
          >
            <option value="de">DE</option>
            <option value="en">EN</option>
          </select>
          <button type="button" onClick={() => onExportGuest(guestLang)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-800">
            {t('menu.exportGuest')}
          </button>
          <button type="button" onClick={onExportInternal} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-800">
            {t('menu.exportInternalPdf')}
          </button>
          <button type="button" onClick={onExportCsv} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-800">
            {t('menu.exportCsv')}
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs text-zinc-400">{t('menu.avgCostPct')}</p>
          <p className="text-lg font-medium text-zinc-100">
            {analytics.avgCostPct !== null ? formatPercent(analytics.avgCostPct, locale) : t('menu.none')}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs text-zinc-400">{t('menu.marginSpread')}</p>
          <p className="text-lg font-medium text-zinc-100">
            {analytics.marginSpread !== null
              ? `${formatEur(analytics.marginSpread.min, locale)} – ${formatEur(analytics.marginSpread.max, locale)}`
              : t('menu.none')}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs text-zinc-400">{t('menu.worstOffender')}</p>
          <p className="text-lg font-medium text-zinc-100">{worstName}</p>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <select
          aria-label={t('menu.addRecipe')}
          value=""
          onChange={(e) => {
            if (e.target.value !== '') void onAddItem(e.target.value);
          }}
          className="w-64 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
        >
          <option value="">{t('menu.pick')}</option>
          {availableRecipes.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {analytics.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-400">
          {t('menu.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="w-8 px-2 py-3" />
                <th className="px-4 py-3">{t('menu.drink')}</th>
                <SortHeader columnKey="price" sort={sort} onToggle={toggle} label={t('recipe.priceGross')} />
                <SortHeader columnKey="pourCost" sort={sort} onToggle={toggle} label={t('recipe.pourCost')} />
                <SortHeader columnKey="costPct" sort={sort} onToggle={toggle} label={t('recipe.costPct')} />
                <SortHeader columnKey="margin" sort={sort} onToggle={toggle} label={t('recipe.margin')} />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {sortedRows.map((row, index) => {
                const itemId = itemByRecipe.get(row.recipe.id);
                const canReorder = sort === null;
                return (
                  <tr key={row.recipe.id} className={FLAG_ROW_TINT[row.flag] || 'bg-zinc-950/40'}>
                    <td className="px-2 py-3">
                      <span className={`inline-block h-3 w-3 rounded-full ${FLAG_DOT[row.flag]}`} aria-label={row.flag} />
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-100">{row.recipe.name}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      {row.priceGross !== null ? formatEur(row.priceGross, locale) : t('menu.unpriced')}
                    </td>
                    <td className="px-4 py-3 text-positive">{formatEur(row.pourCost, locale)}</td>
                    <td className={`px-4 py-3 font-medium ${FLAG_TEXT[row.flag]}`}>
                      {row.costPct !== null ? formatPercent(row.costPct, locale) : '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {row.marginEur !== null ? formatEur(row.marginEur, locale) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {itemId && canReorder && (
                          <>
                            <button
                              type="button"
                              onClick={() => void onReorder(itemId, 'up')}
                              disabled={index === 0}
                              aria-label={t('menu.moveUp')}
                              className={ICON_BUTTON}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => void onReorder(itemId, 'down')}
                              disabled={index === sortedRows.length - 1}
                              aria-label={t('menu.moveDown')}
                              className={ICON_BUTTON}
                            >
                              ↓
                            </button>
                          </>
                        )}
                        {itemId && (
                          <button
                            type="button"
                            onClick={() => void onRemoveItem(itemId)}
                            aria-label={`${t('menu.removeRecipe')}: ${row.recipe.name}`}
                            className={ICON_BUTTON_DANGER}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
