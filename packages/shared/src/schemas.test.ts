import { describe, expect, it } from 'vitest';
import { budgetSchema, createGroupInput, joinGroupInput } from './schemas.ts';

const base = { name: 'Ufficio', names: ['Anna', 'Marco', 'Giulia'] };

describe('createGroupInput', () => {
  it('accepts a valid group', () => {
    const parsed = createGroupInput.parse({ ...base, budget: 20, ownIndex: 1 });
    expect(parsed.names).toEqual(['Anna', 'Marco', 'Giulia']);
  });

  it('rejects duplicate names, case-insensitively', () => {
    expect(createGroupInput.safeParse({ ...base, names: ['Anna', 'anna', 'Marco'] }).success).toBe(
      false,
    );
  });

  it('rejects too few names and an out-of-range ownIndex', () => {
    expect(createGroupInput.safeParse({ ...base, names: ['Anna', 'Marco'] }).success).toBe(false);
    expect(createGroupInput.safeParse({ ...base, ownIndex: 3 }).success).toBe(false);
  });

  it('rejects names over 40 characters', () => {
    expect(createGroupInput.safeParse({ ...base, names: ['x'.repeat(41), 'a', 'b'] }).success).toBe(
      false,
    );
  });
});

describe('budgetSchema', () => {
  it('allows whole cents only', () => {
    expect(budgetSchema.safeParse(19.99).success).toBe(true);
    expect(budgetSchema.safeParse(19.999).success).toBe(false);
    expect(budgetSchema.safeParse(0).success).toBe(false);
  });
});

describe('joinGroupInput', () => {
  it('normalizes the code', () => {
    const parsed = joinGroupInput.parse({
      code: 'abcd-2345',
      participantId: '6f1c1f4e-6f0a-4c4e-9a52-1f9a7e0b8c11',
    });
    expect(parsed.code).toBe('ABCD2345');
  });
});
