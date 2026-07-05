import { useState } from 'react';

export interface LineDraftBase {
  key: number;
  componentKey: string;
  amount: string;
}

export interface LineDrafts<T extends LineDraftBase> {
  lines: T[];
  add: () => void;
  update: (key: number, patch: Partial<T>) => void;
  remove: (key: number) => void;
  /** For edits that need the current row, e.g. deriving a unit from a selection. */
  replace: (updater: (lines: T[]) => T[]) => void;
}

/** Keyed list of editable component lines shared by the prep and recipe forms. */
export function useLineDrafts<T extends LineDraftBase>(
  makeInitial: () => T[],
  makeEmpty: (key: number) => T,
): LineDrafts<T> {
  const [state, setState] = useState(() => {
    const lines = makeInitial();
    return { lines, nextKey: lines.length };
  });

  return {
    lines: state.lines,
    add: () =>
      setState((s) => ({ lines: [...s.lines, makeEmpty(s.nextKey)], nextKey: s.nextKey + 1 })),
    update: (key, patch) =>
      setState((s) => ({
        ...s,
        lines: s.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
      })),
    remove: (key) => setState((s) => ({ ...s, lines: s.lines.filter((l) => l.key !== key) })),
    replace: (updater) => setState((s) => ({ ...s, lines: updater(s.lines) })),
  };
}
