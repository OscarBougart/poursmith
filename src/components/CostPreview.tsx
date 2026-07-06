import type { ReactElement } from 'react';
import { formatEur, formatPercent } from '@/lib/format';
import type { RagFlag } from '@/lib/menuAnalytics';
import { useLocale, useT } from '@/i18n';
import { FLAG_TEXT } from '@/components/flagColors';

export interface RecipeCostPreview {
  pourCost: number;
  pct: number | null;
  margin: number | null;
  suggested: number;
}

export interface CostPreviewProps {
  preview: RecipeCostPreview | null;
  /** RAG health of the current cost %, colouring the figure as you edit. */
  flag?: RagFlag;
}

/** Live pour cost / cost % / margin / suggested price panel for the recipe form. */
export default function CostPreview({ preview, flag }: CostPreviewProps): ReactElement {
  const t = useT();
  const { locale } = useLocale();
  return (
    <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-border bg-bg-card/60 p-3 text-sm">
      <dt className="text-text-secondary">{t('recipe.pourCost')}</dt>
      <dd className="text-right font-medium text-margin-good">
        {preview !== null ? formatEur(preview.pourCost, locale) : '—'}
      </dd>
      <dt className="text-text-secondary">{t('recipe.costPct')}</dt>
      <dd className={`text-right font-medium ${flag ? FLAG_TEXT[flag] : 'text-text-secondary'}`}>
        {preview?.pct != null ? formatPercent(preview.pct, locale) : '—'}
      </dd>
      <dt className="text-text-secondary">{t('recipe.margin')}</dt>
      <dd className="text-right text-text-secondary">
        {preview?.margin != null ? formatEur(preview.margin, locale) : '—'}
      </dd>
      <dt className="text-text-secondary">{t('recipe.suggestedPrice')}</dt>
      <dd className="text-right font-medium text-text-primary">
        {preview !== null ? formatEur(preview.suggested, locale) : '—'}
      </dd>
    </dl>
  );
}
