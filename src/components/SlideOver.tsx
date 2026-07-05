import { useEffect } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useT } from '@/i18n';
import { ICON_BUTTON } from '@/components/buttonStyles';

export interface SlideOverProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function SlideOver({
  title,
  open,
  onClose,
  children,
}: SlideOverProps): ReactElement | null {
  const t = useT();
  const panelRef = useFocusTrap<HTMLElement>(open);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('common.close')}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/60"
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="absolute top-0 right-0 h-full w-full max-w-md overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-6 shadow-2xl outline-none"
      >
        <header className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-50">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className={ICON_BUTTON}>
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
