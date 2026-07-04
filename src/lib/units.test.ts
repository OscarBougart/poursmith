import { describe, expect, it } from 'vitest';
import { UnitError, convertAmount, isVolumeUnit, toMl } from '@/lib/units';

describe('toMl', () => {
  it('converts volume units with bar factors', () => {
    expect(toMl(1, 'oz')).toBe(30);
    expect(toMl(2, 'cl')).toBe(20);
    expect(toMl(3, 'dash')).toBeCloseTo(2.4, 12);
    expect(toMl(1, 'barspoon')).toBe(5);
    expect(toMl(45, 'ml')).toBe(45);
  });
  it('returns null for non-volume units', () => {
    expect(toMl(5, 'g')).toBeNull();
    expect(toMl(1, 'piece')).toBeNull();
  });
});

describe('isVolumeUnit', () => {
  it('classifies units', () => {
    expect(isVolumeUnit('oz')).toBe(true);
    expect(isVolumeUnit('ml')).toBe(true);
    expect(isVolumeUnit('g')).toBe(false);
    expect(isVolumeUnit('piece')).toBe(false);
  });
});

describe('convertAmount', () => {
  it('converts volume line units to native ml', () => {
    expect(convertAmount(2, 'oz', 'ml')).toBe(60);
    expect(convertAmount(4, 'cl', 'ml')).toBe(40);
    expect(convertAmount(10, 'ml', 'ml')).toBe(10);
  });
  it('passes g and piece through unchanged when they match', () => {
    expect(convertAmount(50, 'g', 'g')).toBe(50);
    expect(convertAmount(1, 'piece', 'piece')).toBe(1);
  });
  it('throws UnitError on incompatible pairs', () => {
    expect(() => convertAmount(1, 'oz', 'g')).toThrowError(UnitError);
    expect(() => convertAmount(1, 'g', 'ml')).toThrowError(UnitError);
    expect(() => convertAmount(1, 'piece', 'g')).toThrowError(UnitError);
    expect(() => convertAmount(1, 'ml', 'piece')).toThrowError(UnitError);
  });
});
