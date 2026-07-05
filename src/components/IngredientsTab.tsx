import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { Category, Ingredient, Library, NewIngredient } from '@/data/types';
import { CATEGORIES } from '@/data/types';
import { ingredientUnitCost } from '@/lib/cost';
import { formatEur, formatNumber, formatPerUnit } from '@/lib/format';
import { sortRows } from '@/lib/tableSort';
import { ingredientUsedBy, ingredientUsedByRecipes } from '@/lib/usage';
import { useTableSort } from '@/hooks/useTableSort';
import { useLocale, useT } from '@/i18n';
import IngredientForm from '@/components/IngredientForm';
import SlideOver from '@/components/SlideOver';
import SortHeader from '@/components/SortHeader';
import { useToast } from '@/components/Toast';

export interface IngredientsTabProps {
  library: Library;
  onAdd: (v: NewIngredient) => Promise<string | null>;
  onUpdate: (id: string, v: NewIngredient) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
  onOpenImport: () => void;
}

type Editing = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; ingredient: Ingredient };

const SORT_KEYS = ['name', 'category', 'pack', 'net', 'waste', 'unitCost'] as const;
type SortKey = (typeof SORT_KEYS)[number];

export default function IngredientsTab({
  library,
  onAdd,
  onUpdate,
  onDelete,
  onOpenImport,
}: IngredientsTabProps): ReactElement {
  const t = useT();
  const { locale } = useLocale();
  const { push } = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [editing, setEditing] = useState<Editing>({ mode: 'closed' });

  const { sort, toggle } = useTableSort<SortKey>('poursmith.sort.ingredients', SORT_KEYS);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = library.ingredients.filter(
      (i) =>
        (category === 'all' || i.category === category) &&
        (needle === '' || i.name.toLowerCase().includes(needle)),
    );
    return sortRows(rows, sort, (i, key) => {
      switch (key) {
        case 'name':
          return i.name;
        case 'category':
          return t(`category.${i.category}`); // sort by what the user sees
        case 'pack':
          return i.pack_size;
        case 'net':
          return i.price_net;
        case 'waste':
          return i.waste_pct;
        case 'unitCost':
          return ingredientUnitCost(i);
      }
    });
  }, [library.ingredients, search, category, sort, t]);

  const current = editing.mode === 'edit' ? editing.ingredient : null;
  const takenNames = useMemo(
    () =>
      library.ingredients
        .filter((i) => i.id !== current?.id)
        .map((i) => i.name),
    [library.ingredients, current],
  );

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
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category | 'all')}
          aria-label={t('ingredient.category')}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
        >
          <option value="all">{t('common.all')}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`category.${c}`)}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-3">
          <button
            type="button"
            onClick={onOpenImport}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
          >
            {t('ingredient.import')}
          </button>
          <button
            type="button"
            onClick={() => setEditing({ mode: 'new' })}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            {t('ingredient.add')}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-400">
          {t('ingredient.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <SortHeader columnKey="name" sort={sort} onToggle={toggle} label={t('common.name')} />
                <SortHeader columnKey="category" sort={sort} onToggle={toggle} label={t('ingredient.category')} />
                <SortHeader columnKey="pack" sort={sort} onToggle={toggle} label={t('ingredient.packSize')} />
                <SortHeader columnKey="net" sort={sort} onToggle={toggle} label={t('ingredient.priceNet')} />
                <SortHeader columnKey="waste" sort={sort} onToggle={toggle} label={t('ingredient.wastePct')} />
                <SortHeader columnKey="unitCost" sort={sort} onToggle={toggle} label={t('ingredient.unitCost')} />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {filtered.map((ingredient) => (
                <tr
                  key={ingredient.id}
                  onClick={() => setEditing({ mode: 'edit', ingredient })}
                  className="cursor-pointer bg-zinc-950/40 transition hover:bg-zinc-900"
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing({ mode: 'edit', ingredient });
                      }}
                      className="font-medium text-zinc-100 hover:underline"
                    >
                      {ingredient.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{t(`category.${ingredient.category}`)}</td>
                  <td className="px-4 py-3 text-zinc-300">
                    {formatNumber(ingredient.pack_size, locale)} {t(`unit.${ingredient.unit}`)}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{formatEur(ingredient.price_net, locale)}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {formatNumber(ingredient.waste_pct, locale)} %
                  </td>
                  <td className="px-4 py-3 font-medium text-positive">
                    {formatPerUnit(ingredientUnitCost(ingredient), t(`unit.${ingredient.unit}`), locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlideOver
        title={current ? t('ingredient.edit') : t('ingredient.add')}
        open={editing.mode !== 'closed'}
        onClose={() => setEditing({ mode: 'closed' })}
      >
        {editing.mode !== 'closed' && (
          <IngredientForm
            key={current?.id ?? 'new'}
            initial={current}
            takenNames={takenNames}
            usedByNames={
              current
                ? [
                    ...ingredientUsedBy(current.id, library),
                    ...ingredientUsedByRecipes(current.id, library),
                  ].map((x) => x.name)
                : []
            }
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
