import { describe, expect, it } from 'vitest';
import { GROUP_SIZE, isValidGroupSize } from './group';

describe('isValidGroupSize', () => {
  it('accepts the bounds', () => {
    expect(isValidGroupSize(GROUP_SIZE.min)).toBe(true);
    expect(isValidGroupSize(GROUP_SIZE.max)).toBe(true);
  });

  it('rejects sizes outside the bounds', () => {
    expect(isValidGroupSize(GROUP_SIZE.min - 1)).toBe(false);
    expect(isValidGroupSize(GROUP_SIZE.max + 1)).toBe(false);
  });

  it('rejects non-integers', () => {
    expect(isValidGroupSize(3.5)).toBe(false);
    expect(isValidGroupSize(Number.NaN)).toBe(false);
  });
});
