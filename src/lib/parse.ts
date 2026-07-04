const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

/** Parses '18,99' or '18.99'; rejects mixed separators and junk. */
export function parseDecimal(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  if (trimmed.includes('.') && trimmed.includes(',')) return null;
  const normalized = trimmed.replace(',', '.');
  if (!DECIMAL_RE.test(normalized)) return null;
  return Number(normalized);
}

const VALID_VAT_RATES = [0, 0.07, 0.19];

/** Accepts '19', '19%', '0.19', '0,19' — only the German rates {0, 7%, 19%}. */
export function parseVatRate(input: string): number | null {
  const parsed = parseDecimal(input.trim().replace(/%$/, ''));
  if (parsed === null) return null;
  const rate = Math.round((parsed >= 1 ? parsed / 100 : parsed) * 100) / 100;
  return VALID_VAT_RATES.includes(rate) ? rate : null;
}
