import type { Locale } from '@/data/types';

const LOCALE_TAGS: Record<Locale, string> = { de: 'de-DE', en: 'en-DE' };

// Intl.NumberFormat construction is the expensive part; reuse one per locale/style.
const cache = new Map<string, Intl.NumberFormat>();
function formatter(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let fmt = cache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALE_TAGS[locale], options);
    cache.set(key, fmt);
  }
  return fmt;
}

export function formatEur(value: number, locale: Locale): string {
  return formatter(locale, { style: 'currency', currency: 'EUR' }).format(value);
}

/** Unit costs need more precision than cents, e.g. '0,0271 €/ml'. */
export function formatPerUnit(value: number, unitLabel: string, locale: Locale): string {
  const formatted = formatter(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
  return `${formatted}/${unitLabel}`;
}

export function formatNumber(value: number, locale: Locale): string {
  return formatter(locale, { maximumFractionDigits: 2 }).format(value);
}

/** A cost fraction (0.15) as a localized percentage, e.g. '15,0 %'. One source
 *  of truth so the on-screen board and the CSV export always agree. */
export function formatPercent(fraction: number, locale: Locale): string {
  const value = formatter(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(fraction * 100);
  return `${value} %`;
}
