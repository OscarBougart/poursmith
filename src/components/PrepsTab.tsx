import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { Fragment } from 'react';
import type { Library, Prep, PrepLine } from '@/data/types';
import { ingredientUnitCost, prepUnitCost } from '@/lib/cost';
import { formatEur, formatNumber, formatPerUnit } from '@/lib/format';
import { sortRows } from '@/lib/tableSort';
import type { PrepInput } from '@/hooks/useLibrary';
import { prepUsedBy, prepUsedByRecipes } from '@/lib/usage';
import { useTableSort } from '@/hooks/useTableSort';
import { useLocale, useT } from '@/i18n';
import { ICON_BUTTON } from '@/components/buttonStyles';
import PrepForm from '@/components/PrepForm';
import SlideOver from '@/components/SlideOver';
import SortHeader from '@/components/SortHeader';
import { useToast } from '@/components/Toast';

export interface PrepsTabProps {
  library: Library;
  onAdd: (v: PrepInput) => Promise<string | null>;
  onUpdate: (id: string, v: PrepInput) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
}

type Editing = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; prep: Prep };

const SORT_KEYS = ['name', 'yield', 'unitCost', 'batchCost', 'components'] as const;
type SortKey = (typeof SORT_KEYS)[number];

interface Row {
  prep: Prep;
  lines: PrepLine[];
  unitCost: number | null;
}

export default function PrepsTab({
  library,
  onAdd,
  onUpdate,
  onDelete,
}: PrepsTabProps): ReactElement {
  const t = useT();
  const { locale } = useLocale();
  const { push } = useToast();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Editing>({ mode: 'closed' });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { sort, toggle: toggleSort } = useTableSort<SortKey>('poursmith.sort.preps', SORT_KEYS);

  const current = editing.mode === 'edit' ? editing.prep : null;

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const models: Row[] = library.preps
      .filter((p) => needle === '' || p.name.toLowerCase().includes(needle))
      .map((prep) => {
        let unitCost: number | null;
        try {
          unitCost = prepUnitCost(prep.id, library);
        } catch {
          unitCost = null;
        }
        return { prep, lines: library.prepLines.filter((l) => l.prep_id === prep.id), unitCost };
      });
    return sortRows(models, sort, (row, key) => {
      switch (key) {
        case 'name':
          return row.prep.name;
        case 'yield':
          return row.prep.yield_amount;
        case 'unitCost':
          return row.unitCost;
        case 'batchCost':
          return row.unitCost === null ? null : row.unitCost * row.prep.yield_amount;
        case 'components':
          return row.lines.length;
      }
    });
  }, [library, search, sort]);

  function toggleExpanded(id: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function lineInfo(line: PrepLine): { name: string; unitLabel: string; cost: number | null } {
    if (line.ingredient_id !== null) {
      const ingredient = library.ingredients.find((i) => i.id === line.ingredient_id);
      if (!ingredient) return { name: '?', unitLabel: '', cost: null };
      return {
        name: ingredient.name,
        unitLabel: t(`unit.${ingredient.unit}`),
        cost: line.amount * ingredientUnitCost(ingredient),
      };
    }
    const prep = library.preps.find((p) => p.id === line.component_prep_id);
    if (!prep) return { name: '?', unitLabel: '', cost: null };
    let unit: number | null;
    try {
      unit = prepUnitCost(prep.id, library);
    } catch {
      unit = null;
    }
    return {
      name: prep.name,
      unitLabel: t(`unit.${prep.yield_unit}`),
      cost: unit === null ? null : line.amount * unit,
    };
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
          className="w-56 rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => setEditing({ mode: 'new' })}
          className="ml-auto rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-d1"
        >
          {t('prep.add')}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-text-secondary">
          {t('prep.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-card text-xs uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="w-10 px-2 py-3" />
                <SortHeader columnKey="name" sort={sort} onToggle={toggleSort} label={t('common.name')} />
                <SortHeader columnKey="yield" sort={sort} onToggle={toggleSort} label={t('prep.yieldAmount')} />
                <SortHeader columnKey="unitCost" sort={sort} onToggle={toggleSort} label={t('prep.unitCost')} />
                <SortHeader columnKey="batchCost" sort={sort} onToggle={toggleSort} label={t('prep.batchCost')} />
                <SortHeader columnKey="components" sort={sort} onToggle={toggleSort} label={t('prep.components')} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {rows.map(({ prep, lines, unitCost }) => {
                const isOpen = expanded.has(prep.id);
                return (
                  <Fragment key={prep.id}>
                    <tr className="bg-bg-card/40 transition hover:bg-bg-elevated">
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(prep.id)}
                          aria-expanded={isOpen}
                          aria-label={`${t('prep.components')}: ${prep.name}`}
                          className={ICON_BUTTON}
                        >
                          {isOpen ? '▾' : '▸'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setEditing({ mode: 'edit', prep })}
                          className="font-medium text-text-primary hover:underline"
                        >
                          {prep.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatNumber(prep.yield_amount, locale)} {t(`unit.${prep.yield_unit}`)}
                      </td>
                      <td className="px-4 py-3 font-medium text-margin-good">
                        {unitCost !== null
                          ? formatPerUnit(unitCost, t(`unit.${prep.yield_unit}`), locale)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {unitCost !== null
                          ? formatEur(unitCost * prep.yield_amount, locale)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{lines.length}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-bg-card/60">
                        <td />
                        <td colSpan={5} className="px-4 py-3">
                          <ul className="flex flex-col gap-1 text-sm">
                            {lines.map((line) => {
                              const info = lineInfo(line);
                              return (
                                <li key={line.id} className="flex justify-between gap-4">
                                  <span className="text-text-secondary">
                                    {info.name} — {formatNumber(line.amount, locale)} {info.unitLabel}
                                  </span>
                                  <span className="text-text-secondary">
                                    {info.cost !== null ? formatEur(info.cost, locale) : '—'}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SlideOver
        title={current ? t('prep.edit') : t('prep.add')}
        open={editing.mode !== 'closed'}
        onClose={() => setEditing({ mode: 'closed' })}
      >
        {editing.mode !== 'closed' && (
          <PrepForm
            key={current?.id ?? 'new'}
            initial={current}
            library={library}
            usedByNames={
              current
                ? [...prepUsedBy(current.id, library), ...prepUsedByRecipes(current.id, library)].map(
                    (x) => x.name,
                  )
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
