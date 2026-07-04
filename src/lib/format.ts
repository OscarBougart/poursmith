import type { Locale } from '@/data/types';

const LOCALE_TAGS: Record<Locale, string> = { de: 'de-DE', en: 'en-DE' };

export function formatEur(value: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

/** Unit costs need more precision than cents, e.g. '0,0271 €/ml'. */
export function formatPerUnit(value: number, unitLabel: string, locale: Locale): string {
  const formatted = new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
  return `${formatted}/${unitLabel}`;
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], { maximumFractionDigits: 2 }).format(value);
}
