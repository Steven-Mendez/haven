import { exercise } from '@haven/core';
import { describe, expect, it } from 'vitest';
import { parseMinutes } from './exercise';

describe('parseMinutes', () => {
  it('accepts whole minutes within the session limits', () => {
    expect(parseMinutes(' 45 ', exercise)).toBe(45);
    expect(parseMinutes('0', exercise)).toBeUndefined();
    expect(parseMinutes('181', exercise)).toBeUndefined();
    expect(parseMinutes('4.5', exercise)).toBeUndefined();
    expect(parseMinutes('', exercise)).toBeUndefined();
  });
});
