import type { ReactElement } from 'react';
import { formatEur, formatPercent } from '@/lib/format';
import { useLocale, useT } from '@/i18n';

export interface RecipeCostPreview {
  pourCost: number;
  pct: number | null;
  margin: number | null;
  suggested: number;
}

/** Live pour cost / cost % / margin / suggested price panel for the recipe form. */
export default function CostPreview({ preview }: { preview: RecipeCostPreview | null }): ReactElement {
  const t = useT();
  const { locale } = useLocale();
  return (
    <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm">
      <dt className="text-zinc-400">{t('recipe.pourCost')}</dt>
      <dd className="text-right font-medium text-emerald-400">
        {preview !== null ? formatEur(preview.pourCost, locale) : '—'}
      </dd>
      <dt className="text-zinc-400">{t('recipe.costPct')}</dt>
      <dd className="text-right text-zinc-200">
        {preview?.pct != null ? formatPercent(preview.pct, locale) : '—'}
      </dd>
      <dt className="text-zinc-400">{t('recipe.margin')}</dt>
      <dd className="text-right text-zinc-200">
        {preview?.margin != null ? formatEur(preview.margin, locale) : '—'}
      </dd>
      <dt className="text-zinc-400">{t('recipe.suggestedPrice')}</dt>
      <dd className="text-right font-medium text-zinc-100">
        {preview !== null ? formatEur(preview.suggested, locale) : '—'}
      </dd>
    </dl>
  );
}
