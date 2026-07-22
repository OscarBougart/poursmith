// Shared button vocabulary: one source of truth for the accent, sizing, touch
// targets, and focus ring. `:focus-visible` also gets a global outline in
// index.css; the ring here reinforces it on the coloured controls.

export const PRIMARY_BUTTON =
  'rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-d1 disabled:opacity-60';

export const SECONDARY_BUTTON =
  'rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition hover:bg-bg-elevated';

export const DANGER_BUTTON =
  'rounded-lg border border-margin-bad/40 px-4 py-2 text-sm text-margin-bad transition hover:bg-margin-bad/10';

/** Icon-only button with a ≥36px touch target (WCAG 2.5.8 clears 24px). */
export const ICON_BUTTON =
  'inline-flex min-h-9 min-w-9 items-center justify-center rounded p-1 leading-none text-text-secondary transition hover:text-text-primary disabled:opacity-30';

/** Destructive icon button (remove / delete) with the same touch target. */
export const ICON_BUTTON_DANGER =
  'inline-flex min-h-9 min-w-9 items-center justify-center rounded p-1 leading-none text-text-secondary transition hover:text-margin-bad disabled:opacity-30';
