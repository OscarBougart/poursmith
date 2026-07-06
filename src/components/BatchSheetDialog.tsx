import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { Library, Recipe } from '@/data/types';
import type { BatchSheet } from '@/lib/batch';
import { DILUTION_PRESETS, batchForServes, batchForVolume } from '@/lib/batch';
import { formatEur, formatNumber } from '@/lib/format';
import { parseDecimal } from '@/lib/parse';
import { useLocale, useT } from '@/i18n';
import SlideOver from '@/components/SlideOver';

export interface BatchSheetDialogProps {
  recipe: Recipe | null;
  library: Library;
  onClose: () => void;
}

type Mode = 'serves' | 'volume';

const INPUT_CLASS =
  'w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-green';

export default function BatchSheetDialog({
  recipe,
  library,
  onClose,
}: BatchSheetDialogProps): ReactElement | null {
  const t = useT();
  const { locale } = useLocale();
  const [mode, setMode] = useState<Mode>('serves');
  const [serves, setServes] = useState('10');
  const [targetVolume, setTargetVolume] = useState('1000');
  const [dilution, setDilution] = useState<string | null>(null);

  const dilutionValue = dilution ?? (recipe ? String(DILUTION_PRESETS[recipe.method]) : '20');

  const sheet: BatchSheet | null = useMemo(() => {
    if (!recipe) return null;
    const d = parseDecimal(dilutionValue);
    if (d === null || d < 0) return null;
    try {
      if (mode === 'serves') {
        const n = parseDecimal(serves);
        if (n === null || n <= 0) return null;
        return batchForServes(recipe.id, library, n, d);
      }
      const ml = parseDecimal(targetVolume);
      if (ml === null || ml <= 0) return null;
      return batchForVolume(recipe.id, library, ml, d);
    } catch {
      return null;
    }
  }, [recipe, library, mode, serves, targetVolume, dilutionValue]);

  if (!recipe) return null;

  return (
    <SlideOver title={t('batch.title', { name: recipe.name })} open onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-2 print:hidden" role="radiogroup" aria-label={t('batch.title', { name: recipe.name })}>
        {(['serves', 'volume'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`rounded-lg border px-3 py-2 text-sm transition ${
              mode === m
                ? 'border-green bg-green/15 text-text-primary'
                : 'border-border text-text-secondary hover:bg-bg-elevated'
            }`}
          >
            {t(`batch.mode.${m}`)}
          </button>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 print:hidden">
        {mode === 'serves' ? (
          <div>
            <label htmlFor="batch-serves" className="mb-1 block text-sm text-text-secondary">
              {t('batch.serves')}
            </label>
            <input id="batch-serves" type="text" inputMode="decimal" value={serves} onChange={(e) => setServes(e.target.value)} className={INPUT_CLASS} />
          </div>
        ) : (
          <div>
            <label htmlFor="batch-volume" className="mb-1 block text-sm text-text-secondary">
              {t('batch.mode.volume')}
            </label>
            <input id="batch-volume" type="text" inputMode="decimal" value={targetVolume} onChange={(e) => setTargetVolume(e.target.value)} className={INPUT_CLASS} />
          </div>
        )}
        <div>
          <label htmlFor="batch-dilution" className="mb-1 block text-sm text-text-secondary">
            {t('batch.dilution')}
          </label>
          <input id="batch-dilution" type="text" inputMode="decimal" value={dilutionValue} onChange={(e) => setDilution(e.target.value)} className={INPUT_CLASS} />
        </div>
      </div>

      {sheet !== null && (
        <div className="print-area">
          <h3 className="mb-3 hidden text-lg font-semibold print:block">
            {t('batch.title', { name: recipe.name })} — {formatNumber(sheet.serves, locale)}{' '}
            {t('batch.serves')}
          </h3>
          <table className="mb-4 w-full text-left text-sm">
            <tbody className="divide-y divide-border/70 print:divide-gray-300">
              {sheet.lines.map((line) => (
                <tr key={line.name}>
                  <td className="py-2 text-text-secondary print:text-black">{line.name}</td>
                  <td className="py-2 text-right text-text-secondary print:text-black">
                    {formatNumber(line.amount, locale)} {t(`unit.${line.unit}`)}
                    {line.amountMl !== null && line.unit !== 'ml' && (
                      <span className="text-text-secondary"> ({formatNumber(line.amountMl, locale)} ml)</span>
                    )}
                  </td>
                  <td className="py-2 text-right text-text-secondary print:text-black">
                    {formatEur(line.cost, locale)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-2 text-text-secondary print:text-black">{t('batch.water')}</td>
                <td className="py-2 text-right text-text-secondary print:text-black">
                  {formatNumber(sheet.waterMl, locale)} ml
                </td>
                <td />
              </tr>
            </tbody>
          </table>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-border bg-bg-card/60 p-3 text-sm print:border-gray-300 print:bg-white print:text-black">
            <dt className="text-text-secondary print:text-black">{t('batch.serves')}</dt>
            <dd className="text-right text-text-secondary print:text-black">{formatNumber(sheet.serves, locale)}</dd>
            <dt className="text-text-secondary print:text-black">{t('batch.totalVolume')}</dt>
            <dd className="text-right text-text-secondary print:text-black">{formatNumber(sheet.totalVolumeMl, locale)} ml</dd>
            <dt className="text-text-secondary print:text-black">{t('batch.totalCost')}</dt>
            <dd className="text-right text-text-secondary print:text-black">{formatEur(sheet.totalCost, locale)}</dd>
            <dt className="text-text-secondary print:text-black">{t('batch.costPerServe')}</dt>
            <dd className="text-right font-medium text-margin-good print:text-black">
              {formatEur(sheet.costPerServe, locale)}
            </dd>
          </dl>

          <button
            type="button"
            onClick={() => window.print()}
            className="mt-4 w-full rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition hover:bg-bg-elevated print:hidden"
          >
            {t('batch.print')}
          </button>
        </div>
      )}
    </SlideOver>
  );
}
