import { describe, expect, it } from 'vitest';
import { parseDecimal, parseVatRate } from '@/lib/parse';

describe('parseDecimal', () => {
  it('parses decimal comma', () => {
    expect(parseDecimal('18,99')).toBe(18.99);
  });
  it('parses decimal point', () => {
    expect(parseDecimal('18.99')).toBe(18.99);
  });
  it('parses integers with surrounding whitespace', () => {
    expect(parseDecimal(' 7 ')).toBe(7);
  });
  it('rejects empty input', () => {
    expect(parseDecimal('')).toBeNull();
  });
  it('rejects non-numeric input', () => {
    expect(parseDecimal('abc')).toBeNull();
  });
  it('rejects mixed thousands/decimal separators', () => {
    expect(parseDecimal('1.234,56')).toBeNull();
  });
});

describe('parseVatRate', () => {
  it('accepts percent integers', () => {
    expect(parseVatRate('19')).toBe(0.19);
    expect(parseVatRate('7')).toBe(0.07);
    expect(parseVatRate('0')).toBe(0);
  });
  it('accepts fractions with comma or point', () => {
    expect(parseVatRate('0,19')).toBe(0.19);
    expect(parseVatRate('0.07')).toBe(0.07);
  });
  it('accepts a trailing percent sign', () => {
    expect(parseVatRate('19%')).toBe(0.19);
  });
  it('rejects rates outside the German set', () => {
    expect(parseVatRate('5')).toBeNull();
    expect(parseVatRate('100')).toBeNull();
    expect(parseVatRate('-19')).toBeNull();
    expect(parseVatRate('abc')).toBeNull();
  });
});
