import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Library, Recipe, Settings } from '@/data/types';
import { formatEur, formatPercent } from '@/lib/format';
import { costPct, effectiveTargetPct, grossMarginEur, suggestedPriceGross } from '@/lib/pricing';
import { recipePourCost } from '@/lib/recipeCost';
import type { RecipeInput } from '@/hooks/useLibrary';
import { recipeUsedByMenus } from '@/lib/usage';
import { useLocale, useT } from '@/i18n';
import RecipeForm from '@/components/RecipeForm';
import SlideOver from '@/components/SlideOver';

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
  const [editing, setEditing] = useState<Editing>({ mode: 'closed' });

  const current = editing.mode === 'edit' ? editing.recipe : null;

  function safePourCost(id: string): number | null {
    try {
      return recipePourCost(id, library);
    } catch {
      return null;
    }
  }

  function duplicateName(recipe: Recipe): string {
    const taken = new Set(library.recipes.map((r) => r.name.toLowerCase()));
    const base = `${recipe.name} (${t('recipe.variantSuffix')})`;
    if (!taken.has(base.toLowerCase())) return base;
    let counter = 2;
    while (taken.has(`${base} ${counter}`.toLowerCase())) counter += 1;
    return `${base} ${counter}`;
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setEditing({ mode: 'new' })}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
        >
          {t('recipe.add')}
        </button>
      </div>

      {library.recipes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-400">
          {t('recipe.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-3">{t('common.name')}</th>
                <th className="px-4 py-3">{t('recipe.glass')}</th>
                <th className="px-4 py-3">{t('recipe.priceGross')}</th>
                <th className="px-4 py-3">{t('recipe.pourCost')}</th>
                <th className="px-4 py-3">{t('recipe.costPct')}</th>
                <th className="px-4 py-3">{t('recipe.margin')}</th>
                <th className="px-4 py-3">{t('recipe.suggestedPrice')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {library.recipes.map((recipe) => {
                const pourCost = safePourCost(recipe.id);
                const pct = pourCost !== null ? costPct(pourCost, recipe.price_gross) : null;
                const margin = pourCost !== null ? grossMarginEur(pourCost, recipe.price_gross) : null;
                const suggested =
                  pourCost !== null
                    ? suggestedPriceGross(
                        pourCost,
                        effectiveTargetPct(recipe.target_cost_pct_override, settings),
                      )
                    : null;
                return (
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
                    <td className="px-4 py-3 font-medium text-emerald-400">
                      {pourCost !== null ? formatEur(pourCost, locale) : '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
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
                          onClick={() => void onDuplicate(recipe.id, duplicateName(recipe))}
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
                );
              })}
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
            onSubmit={(v) => (current ? onUpdate(current.id, v) : onAdd(v))}
            onDelete={current ? () => onDelete(current.id) : null}
            onClose={() => setEditing({ mode: 'closed' })}
          />
        )}
      </SlideOver>
    </div>
  );
}
