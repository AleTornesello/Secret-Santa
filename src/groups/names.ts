import { GroupError } from './errors.js';
export function validateNames(input: unknown): string[] {
  if (!Array.isArray(input) || input.length < 2 || input.length > 50) throw new GroupError('INVALID_NAMES');
  const seen = new Set<string>();
  return input.map(value => {
    if (typeof value !== 'string') throw new GroupError('INVALID_NAMES');
    const name = value.trim().normalize('NFC');
    const key = name.toLocaleLowerCase('en-US');
    if (!name || [...name].length > 80 || seen.has(key)) throw new GroupError('INVALID_NAMES');
    seen.add(key);
    return name;
  });
}

