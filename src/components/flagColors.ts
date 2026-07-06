import type { RagFlag } from '@/lib/menuAnalytics';

// One source of truth for how a RAG profitability flag reads as colour, so the
// dot, the cost-% figure, and the row wash all agree across every screen.

/** Status dot fill. */
export const FLAG_DOT: Record<RagFlag, string> = {
  green: 'bg-margin-good',
  amber: 'bg-warning',
  red: 'bg-margin-bad',
  unpriced: 'bg-text-muted',
};

/** Cost-% text colour: the figure itself carries its health. */
export const FLAG_TEXT: Record<RagFlag, string> = {
  green: 'text-margin-good',
  amber: 'text-warning',
  red: 'text-margin-bad',
  unpriced: 'text-text-secondary',
};

/** Row wash — only the drinks that need attention are tinted; healthy and
 *  unpriced rows stay neutral so colour means "look here". */
export const FLAG_ROW_TINT: Record<RagFlag, string> = {
  green: '',
  amber: 'bg-warning/10',
  red: 'bg-margin-bad/10',
  unpriced: '',
};
