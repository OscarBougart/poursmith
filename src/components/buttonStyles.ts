// Shared button vocabulary: one source of truth for the accent, sizing, touch
// targets, and focus ring. `:focus-visible` also gets a global outline in
// index.css; the ring here reinforces it on the coloured controls.

export const PRIMARY_BUTTON =
  'rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-60';

export const SECONDARY_BUTTON =
  'rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800';

export const DANGER_BUTTON =
  'rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 transition hover:bg-red-950/50';

/** Icon-only button with a ≥36px touch target (WCAG 2.5.8 clears 24px). */
export const ICON_BUTTON =
  'inline-flex min-h-9 min-w-9 items-center justify-center rounded p-1 leading-none text-zinc-400 transition hover:text-zinc-100 disabled:opacity-30';

/** Destructive icon button (remove / delete) with the same touch target. */
export const ICON_BUTTON_DANGER =
  'inline-flex min-h-9 min-w-9 items-center justify-center rounded p-1 leading-none text-zinc-400 transition hover:text-red-400 disabled:opacity-30';
