import { describe, expect, it } from 'vitest';
import {
  generateJoinCode,
  isValidJoinCode,
  JOIN_CODE_ALPHABET,
  normalizeJoinCode,
} from './joinCode.ts';

describe('join codes', () => {
  it('uses a 31 symbol alphabet with no look-alikes', () => {
    expect(JOIN_CODE_ALPHABET).toHaveLength(31);
    expect(JOIN_CODE_ALPHABET).not.toMatch(/[01ILO]/);
  });

  it('generates valid codes', () => {
    for (let i = 0; i < 1000; i++) expect(isValidJoinCode(generateJoinCode())).toBe(true);
  });

  it('normalizes typed input', () => {
    expect(normalizeJoinCode(' abcd-2345 ')).toBe('ABCD2345');
    expect(isValidJoinCode(normalizeJoinCode('abcd 2345'))).toBe(true);
  });

  it('rejects bad codes', () => {
    expect(isValidJoinCode('ABCD234')).toBe(false);
    expect(isValidJoinCode('ABCD2340')).toBe(false);
    expect(isValidJoinCode('ABCDO345')).toBe(false);
  });
});
