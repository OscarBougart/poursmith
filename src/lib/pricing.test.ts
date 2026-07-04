import { describe, expect, it } from 'vitest';
import {
  costPct,
  effectiveTargetPct,
  grossMarginEur,
  netOfVat,
  roundUpTo,
  suggestedPriceGross,
} from '@/lib/pricing';

describe('netOfVat', () => {
  it('strips 19% sales VAT', () => {
    expect(netOfVat(11.9)).toBeCloseTo(10, 12);
    expect(netOfVat(0)).toBe(0);
  });
});

describe('costPct', () => {
  it('computes pour cost over net price as a fraction', () => {
    expect(costPct(2, 11.9)).toBeCloseTo(0.2, 12);
  });
  it('is null without a usable price', () => {
    expect(costPct(2, null)).toBeNull();
    expect(costPct(2, 0)).toBeNull();
  });
});

describe('grossMarginEur', () => {
  it('is net price minus pour cost', () => {
    expect(grossMarginEur(2, 11.9)).toBeCloseTo(8, 12);
  });
  it('is null without a usable price', () => {
    expect(grossMarginEur(2, null)).toBeNull();
    expect(grossMarginEur(2, 0)).toBeNull();
  });
});

describe('effectiveTargetPct', () => {
  it('prefers the recipe override', () => {
    expect(effectiveTargetPct(25, { target_cost_pct: 18 })).toBe(25);
  });
  it('falls back to settings, then 20', () => {
    expect(effectiveTargetPct(null, { target_cost_pct: 18 })).toBe(18);
    expect(effectiveTargetPct(null, null)).toBe(20);
  });
});

describe('roundUpTo', () => {
  it('rounds up to the step', () => {
    expect(roundUpTo(0.5, 12.17)).toBe(12.5);
    expect(roundUpTo(0.5, 12.51)).toBe(13);
  });
  it('leaves exact steps unchanged despite float noise', () => {
    expect(roundUpTo(0.5, 12.5)).toBe(12.5);
    expect(roundUpTo(0.5, 0.1 + 0.2 + 0.2)).toBe(0.5);
  });
});

describe('suggestedPriceGross', () => {
  it('targets the cost percentage, adds VAT, rounds up to 0.50', () => {
    // 2.05 / 0.20 = 10.25 net → 12.1975 gross → 12.50
    expect(suggestedPriceGross(2.05, 20)).toBe(12.5);
  });
  it('keeps exact half-euro results', () => {
    // 2.10084... → net 10.5042 → gross 12.50 exactly
    expect(suggestedPriceGross(netOfVat(12.5) * 0.2, 20)).toBe(12.5);
  });
});
