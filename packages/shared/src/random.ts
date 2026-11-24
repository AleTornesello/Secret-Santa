/** Uniform random integer in [0, max), from the platform's cryptographic random source. */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) {
    throw new RangeError(`max must be an integer in 1..2^32, got ${max}`);
  }
  // Reject values from the incomplete last block so every result is equally likely.
  const limit = 2 ** 32 - (2 ** 32 % max);
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0] as number;
    if (value < limit) return value % max;
  }
}

export type RandomInt = (max: number) => number;
