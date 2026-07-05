import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { Library, Locale, Menu, Settings } from '@/data/types';
import { formatEur } from '@/lib/format';
import type { MenuRow, RagFlag } from '@/lib/menuAnalytics';
import { menuAnalytics } from '@/lib/menuAnalytics';
import { useLocale, useT } from '@/i18n';

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

type SortKey = 'order' | 'price' | 'pourCost' | 'costPct' | 'margin';

const FLAG_DOT: Record<RagFlag, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  unpriced: 'bg-zinc-600',
};

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
  const [sortKey, setSortKey] = useState<SortKey>('order');
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

  const sortedRows = useMemo(() => {
    if (sortKey === 'order') return analytics.rows;
    const withValue = (r: MenuRow): number => {
      switch (sortKey) {
        case 'price':
          return r.priceGross ?? Infinity;
        case 'pourCost':
          return r.pourCost;
        case 'costPct':
          return r.costPct ?? Infinity;
        case 'margin':
          return r.marginEur ?? -Infinity;
      }
    };
    return [...analytics.rows].sort((a, b) => withValue(a) - withValue(b));
  }, [analytics.rows, sortKey]);

  const availableRecipes = useMemo(
    () => library.recipes.filter((r) => !itemByRecipe.has(r.id)),
    [library.recipes, itemByRecipe],
  );

  const worstOffenderName =
    analytics.worstOffenderId !== null
      ? (library.recipes.find((r) => r.id === analytics.worstOffenderId)?.name ?? t('menu.none'))
      : t('menu.none');

  function header(key: SortKey, label: string): ReactElement {
    if (key === 'order') return <th className="px-4 py-3">{label}</th>;
    return (
      <th className="px-4 py-3">
        <button
          type="button"
          onClick={() => setSortKey(key)}
          aria-pressed={sortKey === key}
          className={`transition hover:text-zinc-200 ${sortKey === key ? 'text-emerald-400' : ''}`}
        >
          {label} {sortKey === key ? '↑' : ''}
        </button>
      </th>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-50">{menu.name}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={guestLang}
            onChange={(e) => setGuestLang(e.target.value as Locale)}
            aria-label={t('menu.language')}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500"
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

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs text-zinc-500">{t('menu.avgCostPct')}</p>
          <p className="text-lg font-medium text-zinc-100">
            {analytics.avgCostPct !== null ? `${(analytics.avgCostPct * 100).toFixed(1)} %` : t('menu.none')}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs text-zinc-500">{t('menu.marginSpread')}</p>
          <p className="text-lg font-medium text-zinc-100">
            {analytics.marginSpread !== null
              ? `${formatEur(analytics.marginSpread.min, locale)} – ${formatEur(analytics.marginSpread.max, locale)}`
              : t('menu.none')}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs text-zinc-500">{t('menu.worstOffender')}</p>
          <p className="text-lg font-medium text-zinc-100">{worstOffenderName}</p>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <select
          aria-label={t('menu.addRecipe')}
          value=""
          onChange={(e) => {
            if (e.target.value !== '') void onAddItem(e.target.value);
          }}
          className="w-64 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
        >
          <option value="">{t('menu.pick')}</option>
          {availableRecipes.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {analytics.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
          {t('menu.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="w-8 px-2 py-3" />
                {header('order', t('menu.drink'))}
                {header('price', t('recipe.priceGross'))}
                {header('pourCost', t('recipe.pourCost'))}
                {header('costPct', t('recipe.costPct'))}
                {header('margin', t('recipe.margin'))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {sortedRows.map((row, index) => {
                const itemId = itemByRecipe.get(row.recipe.id);
                const canReorder = sortKey === 'order';
                return (
                  <tr key={row.recipe.id} className="bg-zinc-950/40">
                    <td className="px-2 py-3">
                      <span className={`inline-block h-3 w-3 rounded-full ${FLAG_DOT[row.flag]}`} aria-label={row.flag} />
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-100">{row.recipe.name}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      {row.priceGross !== null ? formatEur(row.priceGross, locale) : t('menu.unpriced')}
                    </td>
                    <td className="px-4 py-3 text-emerald-400">{formatEur(row.pourCost, locale)}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      {row.costPct !== null ? `${(row.costPct * 100).toFixed(1)} %` : '—'}
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
                              className="rounded p-1 text-zinc-400 transition hover:text-zinc-100 disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => void onReorder(itemId, 'down')}
                              disabled={index === sortedRows.length - 1}
                              aria-label={t('menu.moveDown')}
                              className="rounded p-1 text-zinc-400 transition hover:text-zinc-100 disabled:opacity-30"
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
                            className="rounded p-1 text-zinc-500 transition hover:text-red-400"
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
