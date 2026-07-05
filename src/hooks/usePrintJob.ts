import { useEffect, useState } from 'react';
import type { Locale, Menu } from '@/data/types';

export type PrintJob =
  | { kind: 'guest'; menu: Menu; language: Locale }
  | { kind: 'internal'; menu: Menu }
  | null;

/**
 * Holds the pending print view and fires the browser print dialog once it has
 * painted, clearing the job when printing finishes.
 */
export function usePrintJob(): [PrintJob, (job: PrintJob) => void] {
  const [printJob, setPrintJob] = useState<PrintJob>(null);

  useEffect(() => {
    if (printJob === null) return;
    const done = (): void => setPrintJob(null);
    window.addEventListener('afterprint', done);
    const id = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', done);
    };
  }, [printJob]);

  return [printJob, setPrintJob];
}
