import { GroupError } from '../groups/errors.js';
export function createRateStore(options: { now: () => number; maxKeys: number; windowMs: number }) {
  const records = new Map<string, { totalHits: number; resetTime: Date }>();
  function prune() { for (const [key, value] of records) if (value.resetTime.getTime() <= options.now()) records.delete(key); }
  const timer = setInterval(prune, Math.min(options.windowMs, 30000)); timer.unref();
  return {
    localKeys: true,
    increment(key: string) {
      prune(); let value = records.get(key);
      if (!value) {
        if (records.size >= options.maxKeys) throw new GroupError('CAPACITY_REACHED');
        value = { totalHits: 0, resetTime: new Date(options.now() + options.windowMs) }; records.set(key, value);
      }
      value.totalHits++; return { ...value, resetTime: new Date(value.resetTime) };
    },
    decrement(key: string) { const value = records.get(key); if (value) value.totalHits = Math.max(0, value.totalHits - 1); },
    resetKey(key: string) { records.delete(key); },
    shutdown() { clearInterval(timer); records.clear(); },
  };
}

