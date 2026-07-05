import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * useState persisted to localStorage as JSON. `validate` guards against stale
 * or corrupted stored values (schema changes, other tabs, hand-edits); when it
 * rejects, the initial value wins. Storage failures (private mode, quota) are
 * swallowed — the state just won't persist, same policy as the locale toggle.
 */
export function usePersistentState<T>(
  storageKey: string,
  initial: T,
  validate: (candidate: unknown) => candidate is T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return initial;
      const parsed: unknown = JSON.parse(raw);
      return validate(parsed) ? parsed : initial;
    } catch {
      return initial;
    }
  });

  const set: Dispatch<SetStateAction<T>> = useCallback(
    (action) => {
      setValue((prev) => {
        const next = typeof action === 'function' ? (action as (p: T) => T)(prev) : action;
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // storage unavailable — keep the in-memory value
        }
        return next;
      });
    },
    [storageKey],
  );

  return [value, set];
}
