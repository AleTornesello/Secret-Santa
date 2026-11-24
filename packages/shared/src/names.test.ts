import { describe, expect, it } from 'vitest';
import { parseNames } from './names.ts';

describe('parseNames', () => {
  it('splits lines, trims, collapses spaces and drops blanks', () => {
    expect(parseNames('  Anna \r\n\nMarco   Rossi\n   \nGiulia')).toEqual([
      'Anna',
      'Marco Rossi',
      'Giulia',
    ]);
  });
});
