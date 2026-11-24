import { budgetSchema, GROUP_SIZE, groupNameSchema, parseNames } from '@secret-santa/shared';
import type { CreateGroupInput } from '@secret-santa/shared';
import type { Messages } from '../i18n/en';

export interface GroupFormValues {
  name: string;
  budget: string;
  names: string;
  playing: boolean;
  /** The organizer's own name, picked from the parsed names. */
  ownName: string;
}

export type GroupFormErrors = Partial<Record<'name' | 'budget' | 'names' | 'ownName', string>>;

/** "25,50" and "25.50" both mean 25.5; empty means no budget; anything else is invalid. */
export function parseBudget(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!/^\d{1,6}([.,]\d{1,2})?$/.test(trimmed)) return undefined;
  return Number(trimmed.replace(',', '.'));
}

export function validateGroupForm(
  values: GroupFormValues,
  t: Messages,
): { input?: CreateGroupInput; errors: GroupFormErrors } {
  const errors: GroupFormErrors = {};

  const name = groupNameSchema.safeParse(values.name);
  if (!name.success) errors.name = t['new.errorName'];

  const budget = parseBudget(values.budget);
  if (budget === undefined || (budget !== null && !budgetSchema.safeParse(budget).success)) {
    errors.budget = t['new.errorBudget'];
  }

  const names = parseNames(values.names);
  const seen = new Set<string>();
  const duplicate = names.find((n) => {
    const key = n.toLowerCase();
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
  const tooLong = names.find((n) => n.length > 40);
  if (names.length < GROUP_SIZE.min) errors.names = t['new.errorTooFew'];
  else if (names.length > GROUP_SIZE.max) errors.names = t['new.errorTooMany'];
  else if (tooLong) errors.names = t['new.errorLong'](tooLong);
  else if (duplicate) errors.names = t['new.errorDuplicate'](duplicate);

  const ownIndex = values.playing ? names.indexOf(values.ownName) : null;
  if (ownIndex === -1) errors.ownName = t['new.errorOwn'];

  if (Object.keys(errors).length > 0 || !name.success) return { errors };
  return {
    errors,
    input: { name: name.data, budget: budget ?? null, names, ownIndex },
  };
}
