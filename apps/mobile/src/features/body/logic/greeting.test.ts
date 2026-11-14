import { describe, expect, it } from 'vitest';
import { dayPart } from './greeting';

describe('greeting', () => {
  it('splits the day by local hour', () => {
    expect(dayPart(5)).toBe('morning');
    expect(dayPart(11)).toBe('morning');
    expect(dayPart(12)).toBe('afternoon');
    expect(dayPart(19)).toBe('afternoon');
    expect(dayPart(20)).toBe('evening');
    expect(dayPart(23)).toBe('evening');
    expect(dayPart(0)).toBe('night');
    expect(dayPart(4)).toBe('night');
  });
});
