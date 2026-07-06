import type { ReactElement } from 'react';
import type { Library, RecipeUnit } from '@/data/types';
import { RECIPE_UNITS } from '@/data/types';
import { componentName } from '@/lib/component';
import type { LineFieldErrors } from '@/components/PrepLinesEditor';
import { useT } from '@/i18n';
import { INPUT_CLASS } from '@/components/formStyles';

export interface RecipeLineDraft {
  key: number;
  componentKey: string;
  amount: string;
  unit: RecipeUnit;
  is_garnish: boolean;
}

export interface RecipeLinesEditorProps {
  lines: RecipeLineDraft[];
  library: Library;
  errors: Record<number, LineFieldErrors>;
  linesError?: string;
  onSelectComponent: (key: number, componentKey: string) => void;
  onUpdate: (key: number, patch: Partial<RecipeLineDraft>) => void;
  onRemove: (key: number) => void;
  onAdd: () => void;
}

export default function RecipeLinesEditor({
  lines,
  library,
  errors,
  linesError,
  onSelectComponent,
  onUpdate,
  onRemove,
  onAdd,
}: RecipeLinesEditorProps): ReactElement {
  const t = useT();

  return (
    <fieldset className="mb-4">
      <legend className="mb-2 block text-sm text-text-secondary">{t('prep.components')}</legend>
      {linesError !== undefined && (
        <p role="alert" className="mb-2 text-xs text-margin-bad">
          {linesError}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {lines.map((line) => {
          const errs = errors[line.key];
          return (
            <div key={line.key} className="flex flex-wrap items-start gap-2">
              <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                <select
                  value={line.componentKey}
                  onChange={(e) => onSelectComponent(line.key, e.target.value)}
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
                    {library.preps.map((p) => (
                      <option key={p.id} value={`p:${p.id}`}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
                {errs?.component && <p role="alert" className="mt-1 text-xs text-margin-bad">{errs.component}</p>}
              </div>
              <div className="w-20">
                <input
                  type="text"
                  inputMode="decimal"
                  value={line.amount}
                  onChange={(e) => onUpdate(line.key, { amount: e.target.value })}
                  aria-label={t('prep.amount')}
                  className={INPUT_CLASS}
                />
                {errs?.amount && <p role="alert" className="mt-1 text-xs text-margin-bad">{errs.amount}</p>}
              </div>
              <select
                value={line.unit}
                onChange={(e) => onUpdate(line.key, { unit: e.target.value as RecipeUnit })}
                aria-label={t('ingredient.unit')}
                className="w-24 rounded-lg border border-border bg-bg-primary px-2 py-2 text-text-primary outline-none focus:border-green"
              >
                {RECIPE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {t(`unit.${u}`)}
                  </option>
                ))}
              </select>
              <label className="mt-2.5 flex shrink-0 items-center gap-1 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={line.is_garnish}
                  onChange={(e) => onUpdate(line.key, { is_garnish: e.target.checked })}
                  className="accent-green"
                />
                {t('recipe.garnish')}
              </label>
              <button
                type="button"
                onClick={() => onRemove(line.key)}
                aria-label={`${t('common.delete')}: ${
                  line.componentKey === '' ? t('prep.component') : componentName(line.componentKey, library)
                }`}
                className="mt-1 rounded p-1 text-lg leading-none text-text-secondary transition hover:text-margin-bad"
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
        className="mt-2 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-text-secondary transition hover:bg-bg-elevated"
      >
        + {t('prep.addLine')}
      </button>
    </fieldset>
  );
}
