import { useMemo, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { Library, NewPrepLine, Prep, PrepLine, Unit } from '@/data/types';
import { UNITS } from '@/data/types';
import { decodeComponent, encodeComponent } from '@/lib/component';
import { prepUnitCost } from '@/lib/cost';
import { formatPerUnit } from '@/lib/format';
import { parseDecimal } from '@/lib/parse';
import type { PrepInput } from '@/hooks/useLibrary';
import type { LineDraftBase } from '@/hooks/useLineDrafts';
import { useLineDrafts } from '@/hooks/useLineDrafts';
import type { MessageKey } from '@/i18n';
import { useLocale, useT } from '@/i18n';
import ErrorBanner from '@/components/ErrorBanner';
import Field from '@/components/Field';
import FormActions from '@/components/FormActions';
import PrepLinesEditor from '@/components/PrepLinesEditor';
import type { LineFieldErrors } from '@/components/PrepLinesEditor';
import { INPUT_CLASS } from '@/components/formStyles';

export interface PrepFormProps {
  initial: Prep | null;
  library: Library;
  usedByNames: string[];
  onSubmit: (v: PrepInput) => Promise<string | null>;
  onDelete: (() => Promise<string | null>) | null;
  onClose: () => void;
}

function toNewLine(draft: LineDraftBase): NewPrepLine | null {
  const amount = parseDecimal(draft.amount);
  if (amount === null || amount <= 0) return null;
  const ref = decodeComponent(draft.componentKey);
  if (ref.ingredient_id === null && ref.component_prep_id === null) return null;
  return { ...ref, amount };
}

export default function PrepForm({
  initial,
  library,
  usedByNames,
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
  const drafts = useLineDrafts<LineDraftBase>(
    () =>
      initial
        ? library.prepLines
            .filter((l) => l.prep_id === initial.id)
            .map((l, index) => ({ key: index, componentKey: encodeComponent(l), amount: String(l.amount) }))
        : [{ key: 0, componentKey: '', amount: '' }],
    (key) => ({ key, componentKey: '', amount: '' }),
  );
  const [nameError, setNameError] = useState<MessageKey | null>(null);
  const [yieldError, setYieldError] = useState<MessageKey | null>(null);
  const [linesError, setLinesError] = useState<MessageKey | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<number, LineFieldErrors>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const preview = useMemo(() => {
    const draftLines: PrepLine[] = [];
    for (const draft of drafts.lines) {
      const line = toNewLine(draft);
      if (line !== null) draftLines.push({ ...line, id: `draft-${draft.key}`, prep_id: draftId });
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
  }, [drafts.lines, yieldAmount, yieldUnit, name, library, draftId]);

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

    const nextLineErrors: Record<number, LineFieldErrors> = {};
    const newLines: NewPrepLine[] = [];
    for (const draft of drafts.lines) {
      const errs: LineFieldErrors = {};
      if (draft.componentKey === '') errs.component = t('validation.required');
      const amount = parseDecimal(draft.amount);
      if (amount === null || amount <= 0) errs.amount = t('validation.positive');
      if (errs.component || errs.amount) {
        nextLineErrors[draft.key] = errs;
      } else {
        const line = toNewLine(draft);
        if (line !== null) newLines.push(line);
      }
    }
    const nextLinesError: MessageKey | null = drafts.lines.length === 0 ? 'prep.linesRequired' : null;

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

      <PrepLinesEditor
        lines={drafts.lines}
        library={library}
        draftId={draftId}
        errors={lineErrors}
        linesError={linesError ? t(linesError) : undefined}
        onUpdate={drafts.update}
        onRemove={drafts.remove}
        onAdd={drafts.add}
      />

      <p className="mb-4 text-sm text-zinc-400">
        {t('prep.unitCost')}:{' '}
        <span className="font-medium text-emerald-400">
          {preview !== null ? formatPerUnit(preview, t(`unit.${yieldUnit}`), locale) : '—'}
        </span>
      </p>

      <FormActions
        pending={pending}
        onCancel={onClose}
        onDelete={
          initial && onDelete
            ? {
                usedByNames,
                inUseMessage: t('prep.inUse', { names: usedByNames.join(', ') }),
                confirmMessage: t('prep.deleteConfirm', { name: initial.name }),
                run: () => void handleDelete(),
              }
            : undefined
        }
      />
    </form>
  );
}
