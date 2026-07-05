import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useT } from '@/i18n';

interface ToastItem {
  id: number;
  message: string;
}

interface ToastContextValue {
  push: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ push: () => undefined });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const TOAST_MS = 4000;

/** Bottom-right confirmation toasts. Top of the z-scale (dialogs sit at 40/50). */
export function ToastProvider({ children }: { children: ReactNode }): ReactElement {
  const t = useT();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (message: string) => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((prev) => [...prev, { id, message }]);
      timers.current.set(id, window.setTimeout(() => dismiss(id), TOAST_MS));
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed right-4 bottom-4 z-[60] flex w-72 flex-col gap-2 print:hidden"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="toast-enter flex items-start justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 shadow-xl"
          >
            <p>{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={t('common.close')}
              className="shrink-0 rounded leading-none text-zinc-400 transition hover:text-zinc-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
