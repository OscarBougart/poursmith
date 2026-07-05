import { useState } from 'react';
import type { ReactElement } from 'react';
import { Fragment } from 'react';
import type { Library, Prep, PrepLine } from '@/data/types';
import { ingredientUnitCost, prepTotalCost, prepUnitCost } from '@/lib/cost';
import { formatEur, formatNumber, formatPerUnit } from '@/lib/format';
import type { PrepInput } from '@/hooks/useLibrary';
import { prepUsedBy, prepUsedByRecipes } from '@/hooks/useLibrary';
import { useLocale, useT } from '@/i18n';
import PrepForm from '@/components/PrepForm';
import SlideOver from '@/components/SlideOver';

export interface PrepsTabProps {
  library: Library;
  onAdd: (v: PrepInput) => Promise<string | null>;
  onUpdate: (id: string, v: PrepInput) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
}

type Editing = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; prep: Prep };

export default function PrepsTab({
  library,
  onAdd,
  onUpdate,
  onDelete,
}: PrepsTabProps): ReactElement {
  const t = useT();
  const { locale } = useLocale();
  const [editing, setEditing] = useState<Editing>({ mode: 'closed' });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const current = editing.mode === 'edit' ? editing.prep : null;

  function toggle(id: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function safeUnitCost(id: string): number | null {
    try {
      return prepUnitCost(id, library);
    } catch {
      return null;
    }
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
    const unit = safeUnitCost(prep.id);
    return {
      name: prep.name,
      unitLabel: t(`unit.${prep.yield_unit}`),
      cost: unit === null ? null : line.amount * unit,
    };
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setEditing({ mode: 'new' })}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
        >
          {t('prep.add')}
        </button>
      </div>

      {library.preps.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
          {t('prep.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="w-10 px-2 py-3" />
                <th className="px-4 py-3">{t('common.name')}</th>
                <th className="px-4 py-3">{t('prep.yieldAmount')}</th>
                <th className="px-4 py-3">{t('prep.unitCost')}</th>
                <th className="px-4 py-3">{t('prep.batchCost')}</th>
                <th className="px-4 py-3">{t('prep.components')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {library.preps.map((prep) => {
                const lines = library.prepLines.filter((l) => l.prep_id === prep.id);
                const unitCost = safeUnitCost(prep.id);
                const isOpen = expanded.has(prep.id);
                return (
                  <Fragment key={prep.id}>
                    <tr className="bg-zinc-950/40 transition hover:bg-zinc-900">
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() => toggle(prep.id)}
                          aria-expanded={isOpen}
                          aria-label={`${t('prep.components')}: ${prep.name}`}
                          className="rounded p-1 text-zinc-400 transition hover:text-zinc-100"
                        >
                          {isOpen ? '▾' : '▸'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setEditing({ mode: 'edit', prep })}
                          className="font-medium text-zinc-100 hover:underline"
                        >
                          {prep.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {formatNumber(prep.yield_amount, locale)} {t(`unit.${prep.yield_unit}`)}
                      </td>
                      <td className="px-4 py-3 font-medium text-emerald-400">
                        {unitCost !== null
                          ? formatPerUnit(unitCost, t(`unit.${prep.yield_unit}`), locale)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {unitCost !== null ? formatEur(prepTotalCost(prep.id, library), locale) : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{lines.length}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-zinc-900/60">
                        <td />
                        <td colSpan={5} className="px-4 py-3">
                          <ul className="flex flex-col gap-1 text-sm">
                            {lines.map((line) => {
                              const info = lineInfo(line);
                              return (
                                <li key={line.id} className="flex justify-between gap-4">
                                  <span className="text-zinc-300">
                                    {info.name} — {formatNumber(line.amount, locale)} {info.unitLabel}
                                  </span>
                                  <span className="text-zinc-400">
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
            onSubmit={(v) => (current ? onUpdate(current.id, v) : onAdd(v))}
            onDelete={current ? () => onDelete(current.id) : null}
            onClose={() => setEditing({ mode: 'closed' })}
          />
        )}
      </SlideOver>
    </div>
  );
}
