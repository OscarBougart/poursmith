import { useMemo, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type {
  Library,
  Method,
  NewRecipeLine,
  Recipe,
  RecipeUnit,
  Settings,
  Unit,
} from '@/data/types';
import { METHODS, RECIPE_UNITS } from '@/data/types';
import { GLASSES, ICE_TYPES } from '@/data/barLists';
import { formatEur } from '@/lib/format';
import { parseDecimal } from '@/lib/parse';
import { costPct, effectiveTargetPct, grossMarginEur, suggestedPriceGross } from '@/lib/pricing';
import { recipePourCost } from '@/lib/recipeCost';
import { isVolumeUnit } from '@/lib/units';
import type { RecipeInput } from '@/hooks/useLibrary';
import type { MessageKey } from '@/i18n';
import { useLocale, useT } from '@/i18n';
import ConfirmDialog from '@/components/ConfirmDialog';
import Field from '@/components/Field';

export interface RecipeFormProps {
  initial: Recipe | null;
  library: Library;
  settings: Settings;
  onSubmit: (v: RecipeInput) => Promise<string | null>;
  onDelete: (() => Promise<string | null>) | null;
  onClose: () => void;
}

interface LineDraft {
  key: number;
  componentKey: string; // '' | 'i:<id>' | 'p:<id>'
  amount: string;
  unit: RecipeUnit;
  is_garnish: boolean;
}

interface LineErrors {
  component?: string;
  amount?: string;
}

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500';

function nativeUnitOf(componentKey: string, lib: Library): Unit | null {
  if (componentKey.startsWith('i:')) {
    return lib.ingredients.find((i) => i.id === componentKey.slice(2))?.unit ?? null;
  }
  if (componentKey.startsWith('p:')) {
    return lib.preps.find((p) => p.id === componentKey.slice(2))?.yield_unit ?? null;
  }
  return null;
}

function componentNameOf(componentKey: string, lib: Library): string {
  if (componentKey.startsWith('i:')) {
    return lib.ingredients.find((i) => i.id === componentKey.slice(2))?.name ?? '?';
  }
  if (componentKey.startsWith('p:')) {
    return lib.preps.find((p) => p.id === componentKey.slice(2))?.name ?? '?';
  }
  return '?';
}

function unitCompatible(unit: RecipeUnit, native: Unit | null): boolean {
  if (native === null) return true; // no component chosen yet — flagged separately
  if (native === 'ml') return isVolumeUnit(unit);
  return unit === native;
}

function toDraft(componentKey: string, unit: RecipeUnit): { componentKey: string; unit: RecipeUnit } {
  return { componentKey, unit };
}

export default function RecipeForm({
  initial,
  library,
  settings,
  onSubmit,
  onDelete,
  onClose,
}: RecipeFormProps): ReactElement {
  const t = useT();
  const { locale } = useLocale();
  const draftId = initial?.id ?? '__draft__';

  const [name, setName] = useState(initial?.name ?? '');
  const [glass, setGlass] = useState(initial?.glass ?? '');
  const [ice, setIce] = useState(initial?.ice ?? '');
  const [method, setMethod] = useState<Method>(initial?.method ?? 'shaken');
  const [priceGross, setPriceGross] = useState(
    initial?.price_gross != null ? String(initial.price_gross) : '',
  );
  const [targetOverride, setTargetOverride] = useState(
    initial?.target_cost_pct_override != null ? String(initial.target_cost_pct_override) : '',
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [lines, setLines] = useState<LineDraft[]>(() =>
    initial
      ? library.recipeLines
          .filter((l) => l.recipe_id === initial.id)
          .map((l, index) => ({
            key: index,
            componentKey: l.ingredient_id !== null ? `i:${l.ingredient_id}` : `p:${l.component_prep_id ?? ''}`,
            amount: String(l.amount),
            unit: l.unit,
            is_garnish: l.is_garnish,
          }))
      : [{ key: 0, componentKey: '', amount: '', unit: 'ml', is_garnish: false }],
  );
  const [nextKey, setNextKey] = useState(() => lines.length + 1);
  const [nameError, setNameError] = useState<MessageKey | null>(null);
  const [priceError, setPriceError] = useState<MessageKey | null>(null);
  const [overrideError, setOverrideError] = useState<MessageKey | null>(null);
  const [linesError, setLinesError] = useState<MessageKey | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<number, LineErrors>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function updateLine(key: number, patch: Partial<LineDraft>): void {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function selectComponent(key: number, componentKey: string): void {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const native = nativeUnitOf(componentKey, library);
        const unit = unitCompatible(l.unit, native) ? l.unit : ((native ?? 'ml') as RecipeUnit);
        return { ...l, ...toDraft(componentKey, unit) };
      }),
    );
  }

  function draftNewLines(): { valid: NewRecipeLine[]; all: number } {
    const valid: NewRecipeLine[] = [];
    for (const draft of lines) {
      const amount = parseDecimal(draft.amount);
      const native = nativeUnitOf(draft.componentKey, library);
      if (
        draft.componentKey !== '' &&
        amount !== null &&
        amount > 0 &&
        native !== null &&
        unitCompatible(draft.unit, native)
      ) {
        valid.push({
          ingredient_id: draft.componentKey.startsWith('i:') ? draft.componentKey.slice(2) : null,
          component_prep_id: draft.componentKey.startsWith('p:') ? draft.componentKey.slice(2) : null,
          amount,
          unit: draft.unit,
          is_garnish: draft.is_garnish,
        });
      }
    }
    return { valid, all: lines.length };
  }

  const parsedPrice = priceGross.trim() === '' ? null : parseDecimal(priceGross);
  const parsedOverride = targetOverride.trim() === '' ? null : parseDecimal(targetOverride);

  const preview = useMemo(() => {
    const { valid } = draftNewLines();
    if (valid.length === 0) return null;
    const hypothetical: Library = {
      ...library,
      recipes: [
        ...library.recipes.filter((r) => r.id !== draftId),
        {
          id: draftId,
          name: name || 'draft',
          glass: null,
          ice: null,
          method,
          price_gross: null,
          target_cost_pct_override: null,
          notes: null,
          created_at: '',
          updated_at: '',
        },
      ],
      recipeLines: [
        ...library.recipeLines.filter((l) => l.recipe_id !== draftId),
        ...valid.map((l, index) => ({ ...l, id: `draft-${index}`, recipe_id: draftId })),
      ],
    };
    try {
      const pourCost = recipePourCost(draftId, hypothetical);
      const targetPct = effectiveTargetPct(parsedOverride, settings);
      return {
        pourCost,
        pct: costPct(pourCost, parsedPrice),
        margin: grossMarginEur(pourCost, parsedPrice),
        suggested: suggestedPriceGross(pourCost, targetPct),
      };
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, library, draftId, name, method, parsedPrice, parsedOverride, settings]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = name.trim();
    const taken = library.recipes.some(
      (r) => r.id !== draftId && r.name.toLowerCase() === trimmed.toLowerCase(),
    );
    const nextNameError: MessageKey | null =
      trimmed === '' ? 'validation.required' : taken ? 'validation.nameTaken' : null;
    const nextPriceError: MessageKey | null =
      priceGross.trim() !== '' && (parsedPrice === null || parsedPrice < 0)
        ? 'validation.nonNegative'
        : null;
    const nextOverrideError: MessageKey | null =
      targetOverride.trim() !== '' &&
      (parsedOverride === null || parsedOverride <= 0 || parsedOverride >= 100)
        ? 'validation.wasteRange'
        : null;

    const nextLineErrors: Record<number, LineErrors> = {};
    const newLines: NewRecipeLine[] = [];
    for (const draft of lines) {
      const errors: LineErrors = {};
      const native = nativeUnitOf(draft.componentKey, library);
      if (draft.componentKey === '') {
        errors.component = t('validation.required');
      } else if (native !== null && !unitCompatible(draft.unit, native)) {
        errors.component = t('recipe.unitMismatch', {
          name: componentNameOf(draft.componentKey, library),
        });
      }
      const amount = parseDecimal(draft.amount);
      if (amount === null || amount <= 0) errors.amount = t('validation.positive');
      if (errors.component || errors.amount) {
        nextLineErrors[draft.key] = errors;
      } else if (amount !== null) {
        newLines.push({
          ingredient_id: draft.componentKey.startsWith('i:') ? draft.componentKey.slice(2) : null,
          component_prep_id: draft.componentKey.startsWith('p:') ? draft.componentKey.slice(2) : null,
          amount,
          unit: draft.unit,
          is_garnish: draft.is_garnish,
        });
      }
    }
    const nextLinesError: MessageKey | null = lines.length === 0 ? 'prep.linesRequired' : null;

    setNameError(nextNameError);
    setPriceError(nextPriceError);
    setOverrideError(nextOverrideError);
    setLinesError(nextLinesError);
    setLineErrors(nextLineErrors);
    if (
      nextNameError !== null ||
      nextPriceError !== null ||
      nextOverrideError !== null ||
      nextLinesError !== null ||
      Object.keys(nextLineErrors).length > 0
    ) {
      return;
    }

    setPending(true);
    const message = await onSubmit({
      name: trimmed,
      glass: glass === '' ? null : glass,
      ice: ice === '' ? null : ice,
      method,
      price_gross: parsedPrice,
      target_cost_pct_override: parsedOverride,
      notes: notes.trim() === '' ? null : notes.trim(),
      lines: newLines,
    });
    setPending(false);
    if (message !== null) setServerError(message);
    else onClose();
  }

  async function handleDelete(): Promise<void> {
    if (!onDelete) return;
    setConfirming(false);
    setPending(true);
    const message = await onDelete();
    setPending(false);
    if (message !== null) setServerError(message);
    else onClose();
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate>
      {serverError !== null && (
        <p role="alert" className="mb-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
          {t('common.error.generic', { message: serverError })}
        </p>
      )}

      <Field label={t('common.name')} htmlFor="rec-name" error={nameError ? t(nameError) : undefined}>
        <input id="rec-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field label={t('recipe.glass')} htmlFor="rec-glass">
          <select id="rec-glass" value={glass} onChange={(e) => setGlass(e.target.value)} className={INPUT_CLASS}>
            <option value="">—</option>
            {GLASSES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </Field>
        <Field label={t('recipe.ice')} htmlFor="rec-ice">
          <select id="rec-ice" value={ice} onChange={(e) => setIce(e.target.value)} className={INPUT_CLASS}>
            <option value="">—</option>
            {ICE_TYPES.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </Field>
        <Field label={t('recipe.method')} htmlFor="rec-method">
          <select id="rec-method" value={method} onChange={(e) => setMethod(e.target.value as Method)} className={INPUT_CLASS}>
            {METHODS.map((m) => (
              <option key={m} value={m}>{t(`method.${m}`)}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t('recipe.priceGross')} htmlFor="rec-price" error={priceError ? t(priceError) : undefined}>
          <input id="rec-price" type="text" inputMode="decimal" value={priceGross} onChange={(e) => setPriceGross(e.target.value)} className={INPUT_CLASS} />
        </Field>
        <Field label={t('recipe.targetOverride')} htmlFor="rec-target" error={overrideError ? t(overrideError) : undefined}>
          <input id="rec-target" type="text" inputMode="decimal" value={targetOverride} onChange={(e) => setTargetOverride(e.target.value)} className={INPUT_CLASS} />
        </Field>
      </div>

      <Field label={t('common.notes')} htmlFor="rec-notes">
        <textarea id="rec-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={INPUT_CLASS} />
      </Field>

      <fieldset className="mb-4">
        <legend className="mb-2 block text-sm text-zinc-400">{t('prep.components')}</legend>
        {linesError !== null && (
          <p role="alert" className="mb-2 text-xs text-red-400">{t(linesError)}</p>
        )}
        <div className="flex flex-col gap-2">
          {lines.map((line) => {
            const errors = lineErrors[line.key];
            return (
              <div key={line.key} className="flex items-start gap-2">
                <div className="flex-1">
                  <select
                    value={line.componentKey}
                    onChange={(e) => selectComponent(line.key, e.target.value)}
                    aria-label={t('prep.component')}
                    className={INPUT_CLASS}
                  >
                    <option value="">{t('prep.component')} …</option>
                    <optgroup label={t('nav.ingredients')}>
                      {library.ingredients.map((i) => (
                        <option key={i.id} value={`i:${i.id}`}>{i.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label={t('nav.preps')}>
                      {library.preps.map((p) => (
                        <option key={p.id} value={`p:${p.id}`}>{p.name}</option>
                      ))}
                    </optgroup>
                  </select>
                  {errors?.component && (
                    <p role="alert" className="mt-1 text-xs text-red-400">{errors.component}</p>
                  )}
                </div>
                <div className="w-20">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={line.amount}
                    onChange={(e) => updateLine(line.key, { amount: e.target.value })}
                    aria-label={t('prep.amount')}
                    className={INPUT_CLASS}
                  />
                  {errors?.amount && (
                    <p role="alert" className="mt-1 text-xs text-red-400">{errors.amount}</p>
                  )}
                </div>
                <select
                  value={line.unit}
                  onChange={(e) => updateLine(line.key, { unit: e.target.value as RecipeUnit })}
                  aria-label={t('ingredient.unit')}
                  className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-zinc-100 outline-none focus:border-emerald-500"
                >
                  {RECIPE_UNITS.map((u) => (
                    <option key={u} value={u}>{t(`unit.${u}`)}</option>
                  ))}
                </select>
                <label className="mt-2.5 flex shrink-0 items-center gap-1 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={line.is_garnish}
                    onChange={(e) => updateLine(line.key, { is_garnish: e.target.checked })}
                    className="accent-emerald-600"
                  />
                  {t('recipe.garnish')}
                </label>
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  aria-label={`${t('common.delete')}: ${componentNameOf(line.componentKey, library)}`}
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
          onClick={() => {
            setLines((prev) => [...prev, { key: nextKey, componentKey: '', amount: '', unit: 'ml', is_garnish: false }]);
            setNextKey((k) => k + 1);
          }}
          className="mt-2 rounded-lg border border-dashed border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
        >
          + {t('prep.addLine')}
        </button>
      </fieldset>

      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm">
        <dt className="text-zinc-400">{t('recipe.pourCost')}</dt>
        <dd className="text-right font-medium text-emerald-400">
          {preview !== null ? formatEur(preview.pourCost, locale) : '—'}
        </dd>
        <dt className="text-zinc-400">{t('recipe.costPct')}</dt>
        <dd className="text-right text-zinc-200">
          {preview?.pct != null ? `${(preview.pct * 100).toFixed(1)} %` : '—'}
        </dd>
        <dt className="text-zinc-400">{t('recipe.margin')}</dt>
        <dd className="text-right text-zinc-200">
          {preview?.margin != null ? formatEur(preview.margin, locale) : '—'}
        </dd>
        <dt className="text-zinc-400">{t('recipe.suggestedPrice')}</dt>
        <dd className="text-right font-medium text-zinc-100">
          {preview !== null ? formatEur(preview.suggested, locale) : '—'}
        </dd>
      </dl>

      <div className="mt-6 flex items-center justify-between gap-3">
        {initial && onDelete ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(true)}
            className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 transition hover:bg-red-950/50"
          >
            {t('common.delete')}
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-60"
          >
            {pending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>

      {confirming && initial && (
        <ConfirmDialog
          title={t('common.delete')}
          message={t('recipe.deleteConfirm', { name: initial.name })}
          confirmLabel={t('common.delete')}
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </form>
  );
}
