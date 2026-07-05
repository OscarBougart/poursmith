import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { Ingredient, NewIngredient } from '@/data/types';
import { CATEGORIES, UNITS, VAT_RATES } from '@/data/types';
import { formatEur } from '@/lib/format';
import { parseDecimal, parseVatRate } from '@/lib/parse';
import type { IngredientFormValues } from '@/lib/validation';
import { validateIngredient } from '@/lib/validation';
import { useLocale, useT } from '@/i18n';
import type { IngredientFormErrors } from '@/lib/validation';
import ConfirmDialog from '@/components/ConfirmDialog';
import Field from '@/components/Field';

export interface IngredientFormProps {
  initial: Ingredient | null;
  takenNames: string[];
  usedByNames: string[];
  onSubmit: (v: NewIngredient) => Promise<string | null>;
  onDelete: (() => Promise<string | null>) | null;
  onClose: () => void;
}

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500';

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
  const [values, setValues] = useState<IngredientFormValues>(() => toFormValues(initial));
  const [errors, setErrors] = useState<IngredientFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [blockedByUse, setBlockedByUse] = useState(false);

  function set<K extends keyof IngredientFormValues>(key: K, value: IngredientFormValues[K]): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const gross = parseDecimal(values.price_gross);
  const vat = parseVatRate(values.vat_rate);
  const netPreview = gross !== null && vat !== null ? formatEur(gross / (1 + vat), locale) : '—';

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const result = validateIngredient(values, takenNames);
    setErrors(result.errors);
    if (result.value === null) return;
    setPending(true);
    const message = await onSubmit(result.value);
    setPending(false);
    if (message !== null) {
      setServerError(message);
    } else {
      onClose();
    }
  }

  async function handleDelete(): Promise<void> {
    if (!onDelete) return;
    setConfirming(false);
    setPending(true);
    const message = await onDelete();
    setPending(false);
    if (message !== null) {
      setServerError(message);
    } else {
      onClose();
    }
  }

  const usedByList = usedByNames.join(', ');

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate>
      {serverError !== null && (
        <p role="alert" className="mb-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
          {t('common.error.generic', { message: serverError })}
        </p>
      )}

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

      <div className="grid grid-cols-2 gap-4">
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

      <div className="grid grid-cols-2 gap-4">
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

      {blockedByUse && (
        <p role="alert" className="mb-4 rounded-lg bg-amber-950/60 px-3 py-2 text-sm text-amber-300">
          {t('ingredient.inUse', { names: usedByList })}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        {initial && onDelete ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => (usedByNames.length > 0 ? setBlockedByUse(true) : setConfirming(true))}
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
          message={t('ingredient.deleteConfirm', { name: initial.name })}
          confirmLabel={t('common.delete')}
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </form>
  );
}
