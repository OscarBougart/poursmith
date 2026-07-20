import type { ReactElement } from 'react';
import { usePersistentState } from '@/hooks/usePersistentState';
import { useT } from '@/i18n';

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

/**
 * A one-line context strip for portfolio visitors landing anonymously: says the
 * data is a personal, throwaway sandbox. Dismissal persists so it shows once.
 */
export default function DemoBanner(): ReactElement | null {
  const t = useT();
  const [dismissed, setDismissed] = usePersistentState('poursmith.demoBannerDismissed', false, isBool);
  if (dismissed) return null;

  return (
    <div
      role="status"
      className="border-b border-border bg-bg-card/60 print:hidden"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 text-sm">
        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-margin-good" aria-hidden="true" />
        <p className="text-text-secondary">
          <span className="font-medium text-text-primary">{t('demo.title')}</span>{' '}
          {t('demo.body')}
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t('common.close')}
          className="ml-auto shrink-0 rounded p-0.5 leading-none text-text-secondary opacity-70 transition hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
