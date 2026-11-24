import { describe, expect, it } from 'vitest';
import { drawCycle } from './match.ts';

describe('drawCycle', () => {
  it('forms one cycle with no self or mutual pairs, across many random runs', () => {
    for (let run = 0; run < 10_000; run++) {
      const size = 3 + (run % 20);
      const people = Array.from({ length: size }, (_, i) => `p${i}`);
      const pairs = drawCycle(people);
      expect(pairs).toHaveLength(size);
      const next = new Map(pairs.map((p) => [p.giver, p.receiver]));
      expect(new Set(pairs.map((p) => p.giver)).size).toBe(size);
      expect(new Set(pairs.map((p) => p.receiver)).size).toBe(size);
      for (const { giver, receiver } of pairs) {
        expect(receiver).not.toBe(giver);
        expect(next.get(receiver)).not.toBe(giver);
      }
      // Following receivers from anyone visits everyone exactly once.
      let current = people[0] as string;
      for (let step = 0; step < size; step++) current = next.get(current) as string;
      expect(current).toBe(people[0]);
      const seen = new Set<string>();
      current = people[0] as string;
      do {
        seen.add(current);
        current = next.get(current) as string;
      } while (current !== people[0]);
      expect(seen.size).toBe(size);
    }
  });

  it('makes every cycle of 4 roughly equally likely', () => {
    const counts = new Map<string, number>();
    const runs = 12_000;
    for (let run = 0; run < runs; run++) {
      const pairs = drawCycle(['a', 'b', 'c', 'd']);
      const next = new Map(pairs.map((p) => [p.giver, p.receiver]));
      let key = 'a';
      let current = 'a';
      for (let i = 0; i < 3; i++) {
        current = next.get(current) as string;
        key += current;
      }
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(runs / 6 - 300);
      expect(count).toBeLessThan(runs / 6 + 300);
    }
  });

  it('rejects too few people and duplicates', () => {
    expect(() => drawCycle(['a'])).toThrow(RangeError);
    expect(() => drawCycle(['a', 'b', 'a'])).toThrow(RangeError);
  });
});
