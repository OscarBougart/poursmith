import type { ReactElement } from 'react';
import { useT } from '@/i18n';
import { ICON_BUTTON } from '@/components/buttonStyles';

export interface BannerProps {
  kind: 'error' | 'success';
  message: string;
  onDismiss: () => void;
}

export default function Banner({ kind, message, onDismiss }: BannerProps): ReactElement {
  const t = useT();
  const tone =
    kind === 'error'
      ? 'border-margin-bad/40 bg-margin-bad/10 text-margin-bad'
      : 'border-margin-good/40 bg-margin-good/10 text-margin-good';
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`mb-4 flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm ${tone}`}
    >
      <p>{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('common.close')}
        className={`${ICON_BUTTON} shrink-0`}
      >
        ×
      </button>
    </div>
  );
}
