import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useT } from '@/i18n';
import { ICON_BUTTON } from '@/components/buttonStyles';
import ConfirmDialog from '@/components/ConfirmDialog';

export interface SlideOverProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

interface SlideOverGuard {
  /** Forms report whether they hold unsaved edits. */
  setDirty: (dirty: boolean) => void;
  /** Close via the guard: asks for confirmation while dirty. */
  requestClose: () => void;
}

const SlideOverContext = createContext<SlideOverGuard | null>(null);

/** Guard of the enclosing SlideOver, or null outside one. */
export function useSlideOverGuard(): SlideOverGuard | null {
  return useContext(SlideOverContext);
}

export default function SlideOver({
  title,
  open,
  onClose,
  children,
}: SlideOverProps): ReactElement | null {
  const t = useT();
  const panelRef = useFocusTrap<HTMLElement>(open);
  const dirtyRef = useRef(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const requestClose = useCallback(() => {
    if (dirtyRef.current) setConfirmingDiscard(true);
    else onClose();
  }, [onClose]);

  // A closed panel holds no draft: reset the guard between openings.
  useEffect(() => {
    if (!open) {
      dirtyRef.current = false;
      setConfirmingDiscard(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') requestClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, requestClose]);

  const guard = useMemo<SlideOverGuard>(
    () => ({
      setDirty: (dirty) => {
        dirtyRef.current = dirty;
      },
      requestClose,
    }),
    [requestClose],
  );

  if (!open) return null;

  return (
    <SlideOverContext.Provider value={guard}>
      <div className="fixed inset-0 z-40">
        <button
          type="button"
          tabIndex={-1}
          aria-label={t('common.close')}
          onClick={requestClose}
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
            <button type="button" onClick={requestClose} aria-label={t('common.close')} className={ICON_BUTTON}>
              ×
            </button>
          </header>
          {children}
        </section>
        {confirmingDiscard && (
          <ConfirmDialog
            title={t('form.discardTitle')}
            message={t('form.discardMessage')}
            confirmLabel={t('form.discardConfirm')}
            onConfirm={() => {
              setConfirmingDiscard(false);
              onClose();
            }}
            onCancel={() => setConfirmingDiscard(false)}
          />
        )}
      </div>
    </SlideOverContext.Provider>
  );
}
