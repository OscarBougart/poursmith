import { useMemo, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { Library, Method, NewRecipeLine, Recipe, RecipeUnit, Settings } from '@/data/types';
import { METHODS } from '@/data/types';
import { GLASSES, ICE_TYPES } from '@/data/barLists';
import { componentName, componentNativeUnit, decodeComponent } from '@/lib/component';
import { costPct, effectiveTargetPct, grossMarginEur, suggestedPriceGross } from '@/lib/pricing';
import { parseDecimal } from '@/lib/parse';
import { recipePourCost } from '@/lib/recipeCost';
import { unitCompatible } from '@/lib/units';
import type { RecipeInput } from '@/hooks/useLibrary';
import { useLineDrafts } from '@/hooks/useLineDrafts';
import type { MessageKey } from '@/i18n';
import { useT } from '@/i18n';
import CostPreview from '@/components/CostPreview';
import type { RecipeCostPreview } from '@/components/CostPreview';
import ErrorBanner from '@/components/ErrorBanner';
import Field from '@/components/Field';
import FormActions from '@/components/FormActions';
import RecipeLinesEditor from '@/components/RecipeLinesEditor';
import type { RecipeLineDraft } from '@/components/RecipeLinesEditor';
import type { LineFieldErrors } from '@/components/PrepLinesEditor';
import { INPUT_CLASS } from '@/components/formStyles';

export interface RecipeFormProps {
  initial: Recipe | null;
  library: Library;
  settings: Settings;
  usedByNames: string[];
  onSubmit: (v: RecipeInput) => Promise<string | null>;
  onDelete: (() => Promise<string | null>) | null;
  onClose: () => void;
}

function toNewLine(draft: RecipeLineDraft): NewRecipeLine {
  return {
    ...decodeComponent(draft.componentKey),
    amount: parseDecimal(draft.amount) ?? 0,
    unit: draft.unit,
    is_garnish: draft.is_garnish,
  };
}

export default function RecipeForm({
  initial,
  library,
  settings,
  usedByNames,
  onSubmit,
  onDelete,
  onClose,
}: RecipeFormProps): ReactElement {
  const t = useT();
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
  const [descriptionDe, setDescriptionDe] = useState(initial?.description_de ?? '');
  const [descriptionEn, setDescriptionEn] = useState(initial?.description_en ?? '');
  const drafts = useLineDrafts<RecipeLineDraft>(
    () =>
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
    (key) => ({ key, componentKey: '', amount: '', unit: 'ml', is_garnish: false }),
  );
  const [nameError, setNameError] = useState<MessageKey | null>(null);
  const [priceError, setPriceError] = useState<MessageKey | null>(null);
  const [overrideError, setOverrideError] = useState<MessageKey | null>(null);
  const [linesError, setLinesError] = useState<MessageKey | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<number, LineFieldErrors>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function selectComponent(key: number, componentKey: string): void {
    drafts.replace((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const native = componentNativeUnit(componentKey, library);
        const unit = unitCompatible(l.unit, native) ? l.unit : ((native ?? 'ml') as RecipeUnit);
        return { ...l, componentKey, unit };
      }),
    );
  }

  const parsedPrice = priceGross.trim() === '' ? null : parseDecimal(priceGross);
  const parsedOverride = targetOverride.trim() === '' ? null : parseDecimal(targetOverride);

  const preview = useMemo((): RecipeCostPreview | null => {
    const valid = drafts.lines
      .filter((d) => {
        const native = componentNativeUnit(d.componentKey, library);
        const amount = parseDecimal(d.amount);
        return d.componentKey !== '' && amount !== null && amount > 0 && native !== null && unitCompatible(d.unit, native);
      })
      .map(toNewLine);
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
          description_de: null,
          description_en: null,
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
      return {
        pourCost,
        pct: costPct(pourCost, parsedPrice),
        margin: grossMarginEur(pourCost, parsedPrice),
        suggested: suggestedPriceGross(pourCost, effectiveTargetPct(parsedOverride, settings)),
      };
    } catch {
      return null;
    }
  }, [drafts.lines, library, draftId, name, method, parsedPrice, parsedOverride, settings]);

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

    const nextLineErrors: Record<number, LineFieldErrors> = {};
    const newLines: NewRecipeLine[] = [];
    for (const draft of drafts.lines) {
      const errs: LineFieldErrors = {};
      const native = componentNativeUnit(draft.componentKey, library);
      if (draft.componentKey === '') {
        errs.component = t('validation.required');
      } else if (native !== null && !unitCompatible(draft.unit, native)) {
        errs.component = t('recipe.unitMismatch', { name: componentName(draft.componentKey, library) });
      }
      const amount = parseDecimal(draft.amount);
      if (amount === null || amount <= 0) errs.amount = t('validation.positive');
      if (errs.component || errs.amount) nextLineErrors[draft.key] = errs;
      else newLines.push(toNewLine(draft));
    }
    const nextLinesError: MessageKey | null = drafts.lines.length === 0 ? 'prep.linesRequired' : null;

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
      description_de: descriptionDe.trim() === '' ? null : descriptionDe.trim(),
      description_en: descriptionEn.trim() === '' ? null : descriptionEn.trim(),
      lines: newLines,
    });
    setPending(false);
    if (message !== null) setServerError(message);
    else onClose();
  }

  async function handleDelete(): Promise<void> {
    if (!onDelete) return;
    setPending(true);
    const message = await onDelete();
    setPending(false);
    if (message !== null) setServerError(message);
    else onClose();
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate>
      {serverError !== null && <ErrorBanner message={serverError} />}

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

      <div className="grid grid-cols-2 gap-4">
        <Field label={t('recipe.descriptionDe')} htmlFor="rec-desc-de">
          <textarea id="rec-desc-de" value={descriptionDe} onChange={(e) => setDescriptionDe(e.target.value)} rows={2} className={INPUT_CLASS} />
        </Field>
        <Field label={t('recipe.descriptionEn')} htmlFor="rec-desc-en">
          <textarea id="rec-desc-en" value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} rows={2} className={INPUT_CLASS} />
        </Field>
      </div>

      <RecipeLinesEditor
        lines={drafts.lines}
        library={library}
        errors={lineErrors}
        linesError={linesError ? t(linesError) : undefined}
        onSelectComponent={selectComponent}
        onUpdate={drafts.update}
        onRemove={drafts.remove}
        onAdd={drafts.add}
      />

      <CostPreview preview={preview} />

      <FormActions
        pending={pending}
        onCancel={onClose}
        onDelete={
          initial && onDelete
            ? {
                usedByNames,
                inUseMessage: t('menu.inUse', { names: usedByNames.join(', ') }),
                confirmMessage: t('recipe.deleteConfirm', { name: initial.name }),
                run: () => void handleDelete(),
              }
            : undefined
        }
      />
    </form>
  );
}
