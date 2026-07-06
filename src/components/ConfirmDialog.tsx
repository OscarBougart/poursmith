import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useT } from '@/i18n';

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): ReactElement {
  const t = useT();
  const panelRef = useFocusTrap<HTMLElement>(true);

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('common.cancel')}
        onClick={onCancel}
        className="absolute inset-0 h-full w-full cursor-default bg-black/60"
      />
      <section
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative w-full max-w-sm rounded-2xl border border-border bg-bg-card p-6 shadow-2xl outline-none"
      >
        <h2 className="mb-2 text-lg font-semibold text-text-primary">{title}</h2>
        <p className="mb-6 text-sm text-text-secondary">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition hover:bg-bg-elevated"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-margin-bad px-4 py-2 text-sm font-medium text-bg-primary transition hover:bg-red-d1"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
