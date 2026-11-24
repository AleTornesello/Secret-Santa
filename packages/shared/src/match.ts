import { randomInt, type RandomInt } from './random.ts';

export interface Pair<T> {
  giver: T;
  receiver: T;
}

/**
 * Draws the Secret Santa: shuffles everyone into a random order (Fisher-Yates) and has each
 * person give to the next one, the last giving to the first. The result is one single cycle:
 * nobody draws themselves, and with 3 or more people nobody draws the person who draws them.
 * Every possible cycle is equally likely.
 */
export function drawCycle<T>(people: readonly T[], random: RandomInt = randomInt): Pair<T>[] {
  if (people.length < 2) {
    throw new RangeError('A draw needs at least 2 people');
  }
  if (new Set(people).size !== people.length) {
    throw new RangeError('Every person must appear once');
  }
  const order = [...people];
  for (let i = order.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [order[i], order[j]] = [order[j] as T, order[i] as T];
  }
  return order.map((giver, index) => ({
    giver,
    receiver: order[(index + 1) % order.length] as T,
  }));
}
