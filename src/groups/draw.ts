import { randomInt } from 'node:crypto';
import { GroupError } from './errors.js';
export function assignRecipients(ids: readonly string[], randomIndex: (upperExclusive: number) => number = randomInt): Map<string,string> {
  if (ids.length < 2 || new Set(ids).size !== ids.length) throw new GroupError('INVALID_NAMES');
  for (;;) {
    const shuffled = [...ids];
    for (let i = shuffled.length - 1; i > 0; i--) { const j = randomIndex(i + 1); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    if (shuffled.every((id,i) => id !== ids[i])) return new Map(ids.map((id,i) => [id,shuffled[i]]));
  }
}

