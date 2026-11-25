import type { Page } from '@playwright/test';

export const GROUP_ID = '6f1c1f4e-6f0a-4c4e-9a52-1f9a7e0b8c11';
export const ADMIN = 'a'.repeat(43);
export const PLAYER = 'p'.repeat(43);

/** What preview-group and get-group answer for a group of the given names. */
export function groupView(names: string[], taken: Set<string>, overrides: object = {}) {
  return {
    id: GROUP_ID,
    name: 'Natale in ufficio',
    budget: 20,
    status: 'open',
    joinDeadline: new Date(Date.now() + 24 * 3_600_000).toISOString(),
    joinCode: 'ABCD2345',
    joined: taken.size,
    total: names.length,
    participants: names.map((name) => ({ id: name, name, taken: taken.has(name) })),
    ...overrides,
  };
}

/** Switches the app to English, whatever the browser's language. */
export async function switchToEnglish(page: Page) {
  await page.getByRole('combobox', { name: /Language|Lingua/ }).selectOption('en');
}
