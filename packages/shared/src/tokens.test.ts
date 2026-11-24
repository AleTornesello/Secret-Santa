import { describe, expect, it } from 'vitest';
import { generateToken, hashToken, isTokenFormat } from './tokens.ts';

describe('tokens', () => {
  it('generates distinct 43 character base64url tokens', () => {
    const tokens = new Set(Array.from({ length: 200 }, generateToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(isTokenFormat(token)).toBe(true);
  });

  it('hashes to lowercase SHA-256 hex', async () => {
    expect(await hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('rejects malformed tokens', () => {
    expect(isTokenFormat('short')).toBe(false);
    expect(isTokenFormat('a'.repeat(42) + '=')).toBe(false);
  });
});
