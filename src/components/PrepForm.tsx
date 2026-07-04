import { useMemo, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { Library, NewPrepLine, Prep, PrepLine, Unit } from '@/data/types';
import { UNITS } from '@/data/types';
import { prepUnitCost, wouldCreateCycle } from '@/lib/cost';
import { formatPerUnit } from '@/lib/format';
import { parseDecimal } from '@/lib/parse';
import type { PrepInput } from '@/hooks/useLibrary';
import type { MessageKey } from '@/i18n';
import { useLocale, useT } from '@/i18n';
import ConfirmDialog from '@/components/ConfirmDialog';
import Field from '@/components/Field';

export interface PrepFormProps {
  initial: Prep | null;
  library: Library;
  usedBy: Prep[];
  onSubmit: (v: PrepInput) => Promise<string | null>;
  onDelete: (() => Promise<string | null>) | null;
  onClose: () => void;
}

interface LineDraft {
  key: number;
  componentKey: string; // '' | 'i:<ingredientId>' | 'p:<prepId>'
  amount: string;
}

interface LineErrors {
  component?: MessageKey;
  amount?: MessageKey;
}

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500';

function toLineDrafts(prepId: string | undefined, lines: PrepLine[]): LineDraft[] {
  return lines
    .filter((l) => l.prep_id === prepId)
    .map((l, index) => ({
      key: index,
      componentKey: l.ingredient_id !== null ? `i:${l.ingredient_id}` : `p:${l.component_prep_id ?? ''}`,
      amount: String(l.amount),
    }));
}

function toNewLine(draft: LineDraft): NewPrepLine | null {
  const amount = parseDecimal(draft.amount);
  if (amount === null || amount <= 0) return null;
  if (draft.componentKey.startsWith('i:')) {
    return { ingredient_id: draft.componentKey.slice(2), component_prep_id: null, amount };
  }
  if (draft.componentKey.startsWith('p:')) {
    return { ingredient_id: null, component_prep_id: draft.componentKey.slice(2), amount };
  }
  return null;
}

export default function PrepForm({
  initial,
  library,
  usedBy,
  onSubmit,
  onDelete,
  onClose,
}: PrepFormProps): ReactElement {
  const t = useT();
  const { locale } = useLocale();
  const draftId = initial?.id ?? '__draft__';

  const [name, setName] = useState(initial?.name ?? '');
  const [yieldAmount, setYieldAmount] = useState(initial ? String(initial.yield_amount) : '');
  const [yieldUnit, setYieldUnit] = useState<Unit>(initial?.yield_unit ?? 'ml');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [lines, setLines] = useState<LineDraft[]>(() =>
    initial ? toLineDrafts(initial.id, library.prepLines) : [{ key: 0, componentKey: '', amount: '' }],
  );
  const [nextKey, setNextKey] = useState(() => lines.length + 1);
  const [nameError, setNameError] = useState<MessageKey | null>(null);
  const [yieldError, setYieldError] = useState<MessageKey | null>(null);
  const [linesError, setLinesError] = useState<MessageKey | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<number, LineErrors>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [blockedByUse, setBlockedByUse] = useState(false);

  const selectablePreps = useMemo(
    () =>
      library.preps.filter(
        (p) => p.id !== draftId && !wouldCreateCycle(draftId, p.id, library),
      ),
    [library, draftId],
  );

  const preview = useMemo(() => {
    const draftLines: PrepLine[] = [];
    for (const draft of lines) {
      const line = toNewLine(draft);
      if (line !== null) {
        draftLines.push({ ...line, id: `draft-${draft.key}`, prep_id: draftId });
      }
    }
    const parsedYield = parseDecimal(yieldAmount);
    if (draftLines.length === 0 || parsedYield === null || parsedYield <= 0) return null;
    const hypothetical: Library = {
      ...library,
      preps: [
        ...library.preps.filter((p) => p.id !== draftId),
        {
          id: draftId,
          name: name || 'draft',
          yield_amount: parsedYield,
          yield_unit: yieldUnit,
          notes: null,
          created_at: '',
          updated_at: '',
        },
      ],
      prepLines: [...library.prepLines.filter((l) => l.prep_id !== draftId), ...draftLines],
    };
    try {
      return prepUnitCost(draftId, hypothetical);
    } catch {
      return null;
    }
  }, [lines, yieldAmount, yieldUnit, name, library, draftId]);

  function updateLine(key: number, patch: Partial<LineDraft>): void {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = name.trim();
    const taken = library.preps.some(
      (p) => p.id !== draftId && p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    const parsedYield = parseDecimal(yieldAmount);

    const nextNameError: MessageKey | null =
      trimmed === '' ? 'validation.required' : taken ? 'validation.nameTaken' : null;
    const nextYieldError: MessageKey | null =
      parsedYield === null || parsedYield <= 0 ? 'validation.positive' : null;

    const nextLineErrors: Record<number, LineErrors> = {};
    const newLines: NewPrepLine[] = [];
    for (const draft of lines) {
      const errors: LineErrors = {};
      if (draft.componentKey === '') errors.component = 'validation.required';
      const amount = parseDecimal(draft.amount);
      if (amount === null || amount <= 0) errors.amount = 'validation.positive';
      if (errors.component || errors.amount) {
        nextLineErrors[draft.key] = errors;
      } else {
        const line = toNewLine(draft);
        if (line !== null) newLines.push(line);
      }
    }
    const nextLinesError: MessageKey | null = lines.length === 0 ? 'prep.linesRequired' : null;

    setNameError(nextNameError);
    setYieldError(nextYieldError);
    setLinesError(nextLinesError);
    setLineErrors(nextLineErrors);
    if (
      nextNameError !== null ||
      nextYieldError !== null ||
      nextLinesError !== null ||
      Object.keys(nextLineErrors).length > 0
    ) {
      return;
    }

    setPending(true);
    const message = await onSubmit({
      name: trimmed,
      yield_amount: parsedYield as number,
      yield_unit: yieldUnit,
      notes: notes.trim() === '' ? null : notes.trim(),
      lines: newLines,
    });
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

  function componentLabel(id: string, kind: 'i' | 'p'): string {
    if (kind === 'i') return library.ingredients.find((i) => i.id === id)?.name ?? id;
    return library.preps.find((p) => p.id === id)?.name ?? id;
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate>
      {serverError !== null && (
        <p role="alert" className="mb-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
          {t('common.error.generic', { message: serverError })}
        </p>
      )}

      <Field label={t('common.name')} htmlFor="prep-name" error={nameError ? t(nameError) : undefined}>
        <input
          id="prep-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={INPUT_CLASS}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label={t('prep.yieldAmount')}
          htmlFor="prep-yield"
          error={yieldError ? t(yieldError) : undefined}
        >
          <input
            id="prep-yield"
            type="text"
            inputMode="decimal"
            value={yieldAmount}
            onChange={(e) => setYieldAmount(e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label={t('prep.yieldUnit')} htmlFor="prep-yield-unit">
          <select
            id="prep-yield-unit"
            value={yieldUnit}
            onChange={(e) => setYieldUnit(e.target.value as Unit)}
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

      <Field label={t('common.notes')} htmlFor="prep-notes">
        <textarea
          id="prep-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={INPUT_CLASS}
        />
      </Field>

      <fieldset className="mb-4">
        <legend className="mb-2 block text-sm text-zinc-400">{t('prep.components')}</legend>
        {linesError !== null && (
          <p role="alert" className="mb-2 text-xs text-red-400">
            {t(linesError)}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {lines.map((line) => {
            const errors = lineErrors[line.key];
            const selectedPrepId = line.componentKey.startsWith('p:')
              ? line.componentKey.slice(2)
              : null;
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
                    onChange={(e) => updateLine(line.key, { componentKey: e.target.value })}
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
                  {errors?.component && (
                    <p role="alert" className="mt-1 text-xs text-red-400">
                      {t(errors.component)}
                    </p>
                  )}
                </div>
                <div className="w-28">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={line.amount}
                    onChange={(e) => updateLine(line.key, { amount: e.target.value })}
                    aria-label={t('prep.amount')}
                    className={INPUT_CLASS}
                  />
                  {errors?.amount && (
                    <p role="alert" className="mt-1 text-xs text-red-400">
                      {t(errors.amount)}
                    </p>
                  )}
                </div>
                <span className="mt-2.5 w-10 shrink-0 text-sm text-zinc-500">
                  {line.componentKey.startsWith('i:')
                    ? t(
                        `unit.${
                          library.ingredients.find((i) => i.id === line.componentKey.slice(2))
                            ?.unit ?? 'ml'
                        }`,
                      )
                    : line.componentKey.startsWith('p:')
                      ? t(
                          `unit.${
                            library.preps.find((p) => p.id === line.componentKey.slice(2))
                              ?.yield_unit ?? 'ml'
                          }`,
                        )
                      : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  aria-label={`${t('common.delete')}: ${
                    line.componentKey === ''
                      ? t('prep.component')
                      : componentLabel(
                          line.componentKey.slice(2),
                          line.componentKey.startsWith('i:') ? 'i' : 'p',
                        )
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
          onClick={() => {
            setLines((prev) => [...prev, { key: nextKey, componentKey: '', amount: '' }]);
            setNextKey((k) => k + 1);
          }}
          className="mt-2 rounded-lg border border-dashed border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
        >
          + {t('prep.addLine')}
        </button>
      </fieldset>

      <p className="mb-4 text-sm text-zinc-400">
        {t('prep.unitCost')}:{' '}
        <span className="font-medium text-emerald-400">
          {preview !== null ? formatPerUnit(preview, t(`unit.${yieldUnit}`), locale) : '—'}
        </span>
      </p>

      {blockedByUse && (
        <p role="alert" className="mb-4 rounded-lg bg-amber-950/60 px-3 py-2 text-sm text-amber-300">
          {t('prep.inUse', { names: usedBy.map((p) => p.name).join(', ') })}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        {initial && onDelete ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => (usedBy.length > 0 ? setBlockedByUse(true) : setConfirming(true))}
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
          message={t('prep.deleteConfirm', { name: initial.name })}
          confirmLabel={t('common.delete')}
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </form>
  );
}
