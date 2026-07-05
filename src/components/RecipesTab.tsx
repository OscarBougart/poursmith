import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { Library, Recipe, Settings } from '@/data/types';
import { formatEur, formatPercent } from '@/lib/format';
import { costPct, effectiveTargetPct, grossMarginEur, suggestedPriceGross } from '@/lib/pricing';
import type { RagFlag } from '@/lib/menuAnalytics';
import { ragFlag } from '@/lib/menuAnalytics';
import { recipePourCost } from '@/lib/recipeCost';
import { sortRows } from '@/lib/tableSort';
import type { RecipeInput } from '@/hooks/useLibrary';
import { recipeUsedByMenus } from '@/lib/usage';
import { useTableSort } from '@/hooks/useTableSort';
import { useLocale, useT } from '@/i18n';
import { FLAG_TEXT } from '@/components/flagColors';
import RecipeForm from '@/components/RecipeForm';
import SlideOver from '@/components/SlideOver';
import SortHeader from '@/components/SortHeader';
import { useToast } from '@/components/Toast';

export interface RecipesTabProps {
  library: Library;
  settings: Settings;
  onAdd: (v: RecipeInput) => Promise<string | null>;
  onUpdate: (id: string, v: RecipeInput) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
  onDuplicate: (id: string, newName: string) => Promise<string | null>;
  onOpenBatch: (recipe: Recipe) => void;
}

type Editing = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; recipe: Recipe };

const SORT_KEYS = ['name', 'glass', 'price', 'pourCost', 'costPct', 'margin', 'suggested'] as const;
type SortKey = (typeof SORT_KEYS)[number];

interface Row {
  recipe: Recipe;
  pourCost: number | null;
  pct: number | null;
  margin: number | null;
  suggested: number | null;
  flag: RagFlag;
}

export default function RecipesTab({
  library,
  settings,
  onAdd,
  onUpdate,
  onDelete,
  onDuplicate,
  onOpenBatch,
}: RecipesTabProps): ReactElement {
  const t = useT();
  const { locale } = useLocale();
  const { push } = useToast();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Editing>({ mode: 'closed' });
  const { sort, toggle } = useTableSort<SortKey>('poursmith.sort.recipes', SORT_KEYS);

  const current = editing.mode === 'edit' ? editing.recipe : null;

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const models: Row[] = library.recipes
      .filter((r) => needle === '' || r.name.toLowerCase().includes(needle))
      .map((recipe) => {
        let pourCost: number | null;
        try {
          pourCost = recipePourCost(recipe.id, library);
        } catch {
          pourCost = null;
        }
        const target = effectiveTargetPct(recipe.target_cost_pct_override, settings);
        const pct = pourCost !== null ? costPct(pourCost, recipe.price_gross) : null;
        return {
          recipe,
          pourCost,
          pct,
          margin: pourCost !== null ? grossMarginEur(pourCost, recipe.price_gross) : null,
          suggested: pourCost !== null ? suggestedPriceGross(pourCost, target) : null,
          flag: ragFlag(pct, target),
        };
      });
    return sortRows(models, sort, (row, key) => {
      switch (key) {
        case 'name':
          return row.recipe.name;
        case 'glass':
          return row.recipe.glass;
        case 'price':
          return row.recipe.price_gross;
        case 'pourCost':
          return row.pourCost;
        case 'costPct':
          return row.pct;
        case 'margin':
          return row.margin;
        case 'suggested':
          return row.suggested;
      }
    });
  }, [library, settings, search, sort]);

  function duplicateName(recipe: Recipe): string {
    const taken = new Set(library.recipes.map((r) => r.name.toLowerCase()));
    const base = `${recipe.name} (${t('recipe.variantSuffix')})`;
    if (!taken.has(base.toLowerCase())) return base;
    let counter = 2;
    while (taken.has(`${base} ${counter}`.toLowerCase())) counter += 1;
    return `${base} ${counter}`;
  }

  async function duplicate(recipe: Recipe): Promise<void> {
    const newName = duplicateName(recipe);
    const message = await onDuplicate(recipe.id, newName);
    if (message === null) push(t('toast.saved', { name: newName }));
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.search')}
          aria-label={t('common.search')}
          className="w-56 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => setEditing({ mode: 'new' })}
          className="ml-auto rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
        >
          {t('recipe.add')}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-400">
          {t('recipe.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <SortHeader columnKey="name" sort={sort} onToggle={toggle} label={t('common.name')} />
                <SortHeader columnKey="glass" sort={sort} onToggle={toggle} label={t('recipe.glass')} />
                <SortHeader columnKey="price" sort={sort} onToggle={toggle} label={t('recipe.priceGross')} />
                <SortHeader columnKey="pourCost" sort={sort} onToggle={toggle} label={t('recipe.pourCost')} />
                <SortHeader columnKey="costPct" sort={sort} onToggle={toggle} label={t('recipe.costPct')} />
                <SortHeader columnKey="margin" sort={sort} onToggle={toggle} label={t('recipe.margin')} />
                <SortHeader columnKey="suggested" sort={sort} onToggle={toggle} label={t('recipe.suggestedPrice')} />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {rows.map(({ recipe, pourCost, pct, margin, suggested, flag }) => (
                <tr key={recipe.id} className="bg-zinc-950/40 transition hover:bg-zinc-900">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setEditing({ mode: 'edit', recipe })}
                      className="font-medium text-zinc-100 hover:underline"
                    >
                      {recipe.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{recipe.glass ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-300">
                    {recipe.price_gross != null ? formatEur(recipe.price_gross, locale) : '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-positive">
                    {pourCost !== null ? formatEur(pourCost, locale) : '—'}
                  </td>
                  <td className={`px-4 py-3 font-medium ${FLAG_TEXT[flag]}`}>
                    {pct !== null ? formatPercent(pct, locale) : '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {margin !== null ? formatEur(margin, locale) : '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-100">
                    {suggested !== null ? formatEur(suggested, locale) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void duplicate(recipe)}
                        className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
                      >
                        {t('recipe.duplicate')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenBatch(recipe)}
                        className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
                      >
                        {t('recipe.batchSheet')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlideOver
        title={current ? t('recipe.edit') : t('recipe.add')}
        open={editing.mode !== 'closed'}
        onClose={() => setEditing({ mode: 'closed' })}
      >
        {editing.mode !== 'closed' && (
          <RecipeForm
            key={current?.id ?? 'new'}
            initial={current}
            library={library}
            settings={settings}
            usedByNames={current ? recipeUsedByMenus(current.id, library).map((m) => m.name) : []}
            onSubmit={async (v) => {
              const message = current ? await onUpdate(current.id, v) : await onAdd(v);
              if (message === null) push(t('toast.saved', { name: v.name }));
              return message;
            }}
            onDelete={
              current
                ? async () => {
                    const message = await onDelete(current.id);
                    if (message === null) push(t('toast.deleted', { name: current.name }));
                    return message;
                  }
                : null
            }
            onClose={() => setEditing({ mode: 'closed' })}
          />
        )}
      </SlideOver>
    </div>
  );
}
