import type { ReactElement } from 'react';
import { useT } from '@/i18n';

export interface BannerProps {
  kind: 'error' | 'success';
  message: string;
  onDismiss: () => void;
}

export default function Banner({ kind, message, onDismiss }: BannerProps): ReactElement {
  const t = useT();
  const tone =
    kind === 'error'
      ? 'border-red-900 bg-red-950/60 text-red-200'
      : 'border-emerald-900 bg-emerald-950/60 text-emerald-200';
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
        className="shrink-0 rounded p-0.5 leading-none opacity-70 transition hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
