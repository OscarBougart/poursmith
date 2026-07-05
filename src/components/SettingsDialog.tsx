import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { parseDecimal } from '@/lib/parse';
import { useT } from '@/i18n';
import Field from '@/components/Field';
import SlideOver from '@/components/SlideOver';

export interface SettingsDialogProps {
  open: boolean;
  targetCostPct: number;
  onSave: (pct: number) => Promise<string | null>;
  onClose: () => void;
}

export default function SettingsDialog({
  open,
  targetCostPct,
  onSave,
  onClose,
}: SettingsDialogProps): ReactElement {
  const t = useT();
  const [value, setValue] = useState(String(targetCostPct));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const parsed = parseDecimal(value);
    if (parsed === null || parsed <= 0 || parsed >= 100) {
      setError(t('validation.wasteRange'));
      return;
    }
    setPending(true);
    const message = await onSave(parsed);
    setPending(false);
    if (message !== null) {
      setError(t('common.error.generic', { message }));
    } else {
      setError(null);
      onClose();
    }
  }

  return (
    <SlideOver title={t('settings.title')} open={open} onClose={onClose}>
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <Field label={t('settings.targetCostPct')} htmlFor="settings-target" error={error ?? undefined}>
          <input
            id="settings-target"
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-accent"
          />
        </Field>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? t('common.saving') : t('common.save')}
        </button>
      </form>
    </SlideOver>
  );
}
