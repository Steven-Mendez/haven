import { describe, expect, it } from 'vitest';
import { cabinPressureReading, isPressureChange, kPaFromHPa } from './barometer';

describe('barometer', () => {
  it('converts hPa to kPa with one decimal', () => {
    expect(kPaFromHPa(1013.25)).toBe(101.3);
    expect(kPaFromHPa(565.4)).toBe(56.5);
  });

  it('rejects readings that are not a pressure', () => {
    expect(kPaFromHPa(Number.NaN)).toBeUndefined();
    expect(kPaFromHPa(0)).toBeUndefined();
    expect(kPaFromHPa(5000)).toBeUndefined();
  });

  it('reports a change only from half a kilopascal', () => {
    expect(isPressureChange(undefined, 101.3)).toBe(true);
    expect(isPressureChange(101.3, 101.5)).toBe(false);
    expect(isPressureChange(101.3, 100.8)).toBe(true);
  });

  it('builds a real phone reading, one per value in each 15 minute window', () => {
    const at = (iso: string) =>
      cabinPressureReading({ kPa: 101.3, takenAt: new Date(iso), crewMember: 'elena-vega' });
    const a = at('2026-11-14T10:01:00.000Z');
    expect(a).toMatchObject({
      indicator: 'cabin-pressure',
      value: 101.3,
      unit: 'kPa',
      source: 'phone',
      simulated: false,
      crewMember: 'elena-vega',
    });
    expect(at('2026-11-14T10:09:00.000Z').id).toBe(a.id);
    expect(at('2026-11-14T10:16:00.000Z').id).not.toBe(a.id);
    expect(
      cabinPressureReading({
        kPa: 95,
        takenAt: new Date('2026-11-14T10:02:00.000Z'),
        crewMember: 'elena-vega',
      }).id,
    ).not.toBe(a.id);
  });
});
