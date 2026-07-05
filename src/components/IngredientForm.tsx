import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { Ingredient, NewIngredient } from '@/data/types';
import { CATEGORIES, UNITS, VAT_RATES } from '@/data/types';
import { formatEur } from '@/lib/format';
import { parseDecimal, parseVatRate } from '@/lib/parse';
import { priceNet } from '@/lib/pricing';
import type { IngredientFormValues, IngredientFormErrors } from '@/lib/validation';
import { validateIngredient } from '@/lib/validation';
import { useLocale, useT } from '@/i18n';
import ErrorBanner from '@/components/ErrorBanner';
import Field from '@/components/Field';
import FormActions from '@/components/FormActions';
import { useSlideOverGuard } from '@/components/SlideOver';
import { INPUT_CLASS } from '@/components/formStyles';

export interface IngredientFormProps {
  initial: Ingredient | null;
  takenNames: string[];
  usedByNames: string[];
  onSubmit: (v: NewIngredient) => Promise<string | null>;
  onDelete: (() => Promise<string | null>) | null;
  onClose: () => void;
}

function toFormValues(initial: Ingredient | null): IngredientFormValues {
  if (!initial) {
    return {
      name: '',
      category: 'spirit',
      pack_size: '',
      unit: 'ml',
      price_gross: '',
      vat_rate: '19',
      waste_pct: '0',
    };
  }
  return {
    name: initial.name,
    category: initial.category,
    pack_size: String(initial.pack_size),
    unit: initial.unit,
    price_gross: String(initial.price_gross),
    vat_rate: String(Math.round(initial.vat_rate * 100)),
    waste_pct: String(initial.waste_pct),
  };
}

export default function IngredientForm({
  initial,
  takenNames,
  usedByNames,
  onSubmit,
  onDelete,
  onClose,
}: IngredientFormProps): ReactElement {
  const t = useT();
  const { locale } = useLocale();
  const guard = useSlideOverGuard();
  const [values, setValues] = useState<IngredientFormValues>(() => toFormValues(initial));
  const [errors, setErrors] = useState<IngredientFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Unsaved-changes guard: compare against the first render's snapshot.
  const snapshot = JSON.stringify(values);
  const pristine = useRef(snapshot).current;
  useEffect(() => {
    guard?.setDirty(snapshot !== pristine);
  }, [guard, snapshot, pristine]);

  function set<K extends keyof IngredientFormValues>(key: K, value: IngredientFormValues[K]): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const gross = parseDecimal(values.price_gross);
  const vat = parseVatRate(values.vat_rate);
  const netPreview = gross !== null && vat !== null ? formatEur(priceNet(gross, vat), locale) : '—';

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const result = validateIngredient(values, takenNames);
    setErrors(result.errors);
    if (result.value === null) return;
    setPending(true);
    const message = await onSubmit(result.value);
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

      <Field label={t('common.name')} htmlFor="ing-name" error={errors.name && t(errors.name)}>
        <input
          id="ing-name"
          type="text"
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          className={INPUT_CLASS}
        />
      </Field>

      <Field label={t('ingredient.category')} htmlFor="ing-category">
        <select
          id="ing-category"
          value={values.category}
          onChange={(e) => set('category', e.target.value as IngredientFormValues['category'])}
          className={INPUT_CLASS}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`category.${c}`)}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={t('ingredient.packSize')}
          htmlFor="ing-pack"
          error={errors.pack_size && t(errors.pack_size)}
        >
          <input
            id="ing-pack"
            type="text"
            inputMode="decimal"
            value={values.pack_size}
            onChange={(e) => set('pack_size', e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label={t('ingredient.unit')} htmlFor="ing-unit">
          <select
            id="ing-unit"
            value={values.unit}
            onChange={(e) => set('unit', e.target.value as IngredientFormValues['unit'])}
            className={INPUT_CLASS}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`unit.${u}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={t('ingredient.priceGross')}
          htmlFor="ing-gross"
          error={errors.price_gross && t(errors.price_gross)}
        >
          <input
            id="ing-gross"
            type="text"
            inputMode="decimal"
            value={values.price_gross}
            onChange={(e) => set('price_gross', e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label={t('ingredient.vatRate')}
          htmlFor="ing-vat"
          error={errors.vat_rate && t(errors.vat_rate)}
        >
          <select
            id="ing-vat"
            value={values.vat_rate}
            onChange={(e) => set('vat_rate', e.target.value)}
            className={INPUT_CLASS}
          >
            {VAT_RATES.map((rate) => (
              <option key={rate} value={String(Math.round(rate * 100))}>
                {Math.round(rate * 100)} %
              </option>
            ))}
          </select>
        </Field>
      </div>

      <p className="mb-4 text-sm text-zinc-400">
        {t('ingredient.priceNet')}: <span className="font-medium text-zinc-100">{netPreview}</span>
      </p>

      <Field
        label={t('ingredient.wastePct')}
        htmlFor="ing-waste"
        error={errors.waste_pct && t(errors.waste_pct)}
      >
        <input
          id="ing-waste"
          type="text"
          inputMode="decimal"
          value={values.waste_pct}
          onChange={(e) => set('waste_pct', e.target.value)}
          className={INPUT_CLASS}
        />
      </Field>

      <FormActions
        pending={pending}
        onCancel={guard?.requestClose ?? onClose}
        onDelete={
          initial && onDelete
            ? {
                usedByNames,
                inUseMessage: t('ingredient.inUse', { names: usedByNames.join(', ') }),
                confirmMessage: t('ingredient.deleteConfirm', { name: initial.name }),
                run: () => void handleDelete(),
              }
            : undefined
        }
      />
    </form>
  );
}
