import { useMemo } from 'react';
import type { ReactElement } from 'react';
import type { Library } from '@/data/types';
import { componentName, componentNativeUnit } from '@/lib/component';
import { wouldCreateCycle } from '@/lib/cost';
import type { LineDraftBase } from '@/hooks/useLineDrafts';
import { useT } from '@/i18n';
import { INPUT_CLASS } from '@/components/formStyles';

export interface LineFieldErrors {
  component?: string;
  amount?: string;
}

export interface PrepLinesEditorProps {
  lines: LineDraftBase[];
  library: Library;
  draftId: string;
  errors: Record<number, LineFieldErrors>;
  linesError?: string;
  onUpdate: (key: number, patch: Partial<LineDraftBase>) => void;
  onRemove: (key: number) => void;
  onAdd: () => void;
}

export default function PrepLinesEditor({
  lines,
  library,
  draftId,
  errors,
  linesError,
  onUpdate,
  onRemove,
  onAdd,
}: PrepLinesEditorProps): ReactElement {
  const t = useT();

  const selectablePreps = useMemo(
    () => library.preps.filter((p) => p.id !== draftId && !wouldCreateCycle(draftId, p.id, library)),
    [library, draftId],
  );

  return (
    <fieldset className="mb-4">
      <legend className="mb-2 block text-sm text-zinc-400">{t('prep.components')}</legend>
      {linesError !== undefined && (
        <p role="alert" className="mb-2 text-xs text-red-400">
          {linesError}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {lines.map((line) => {
          const errs = errors[line.key];
          const nativeUnit = componentNativeUnit(line.componentKey, library);
          const selectedPrepId = line.componentKey.startsWith('p:') ? line.componentKey.slice(2) : null;
          // keep an already-selected prep visible even if it would now be filtered
          const prepOptions =
            selectedPrepId !== null && !selectablePreps.some((p) => p.id === selectedPrepId)
              ? [...selectablePreps, ...library.preps.filter((p) => p.id === selectedPrepId)]
              : selectablePreps;
          return (
            <div key={line.key} className="flex items-start gap-2">
              <div className="flex-1">
                <select
                  value={line.componentKey}
                  onChange={(e) => onUpdate(line.key, { componentKey: e.target.value })}
                  aria-label={t('prep.component')}
                  className={INPUT_CLASS}
                >
                  <option value="">{t('prep.component')} …</option>
                  <optgroup label={t('nav.ingredients')}>
                    {library.ingredients.map((i) => (
                      <option key={i.id} value={`i:${i.id}`}>
                        {i.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t('nav.preps')}>
                    {prepOptions.map((p) => (
                      <option key={p.id} value={`p:${p.id}`}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
                {errs?.component && <p role="alert" className="mt-1 text-xs text-red-400">{errs.component}</p>}
              </div>
              <div className="w-28">
                <input
                  type="text"
                  inputMode="decimal"
                  value={line.amount}
                  onChange={(e) => onUpdate(line.key, { amount: e.target.value })}
                  aria-label={t('prep.amount')}
                  className={INPUT_CLASS}
                />
                {errs?.amount && <p role="alert" className="mt-1 text-xs text-red-400">{errs.amount}</p>}
              </div>
              <span className="mt-2.5 w-10 shrink-0 text-sm text-zinc-500">
                {nativeUnit !== null ? t(`unit.${nativeUnit}`) : ''}
              </span>
              <button
                type="button"
                onClick={() => onRemove(line.key)}
                aria-label={`${t('common.delete')}: ${
                  line.componentKey === '' ? t('prep.component') : componentName(line.componentKey, library)
                }`}
                className="mt-1 rounded p-1 text-lg leading-none text-zinc-500 transition hover:text-red-400"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 rounded-lg border border-dashed border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
      >
        + {t('prep.addLine')}
      </button>
    </fieldset>
  );
}
