import { expect, test, type Page } from '@playwright/test';
import { ADMIN, GROUP_ID, groupView, PLAYER, switchToEnglish } from './fixtures';

/** Answers the Edge Function calls in the browser, so these tests need no backend. */
async function mockApi(page: Page) {
  const state = {
    created: null as null | Record<string, unknown>,
    taken: new Set(['Marco']),
  };
  const view = () => groupView(['Anna', 'Giulia', 'Marco'], state.taken);
  await page.route('http://api.test/functions/v1/*', async (route) => {
    const name = route.request().url().split('/').at(-1);
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (name === 'create-group') {
      state.created = body;
      return route.fulfill({
        json: {
          groupId: GROUP_ID,
          joinCode: 'ABCD2345',
          adminToken: ADMIN,
          playerToken: PLAYER,
          participantId: 'Marco',
        },
      });
    }
    if (route.request().headers().authorization !== `Bearer ${ADMIN}`) {
      return route.fulfill({ status: 404, json: { error: 'not_found' } });
    }
    if (name === 'release-claim') state.taken.delete(String(body.participantId));
    return route.fulfill({ json: view() });
  });
  return state;
}

test('an organizer creates a group and gets everything needed to invite friends', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const api = await mockApi(page);
  await page.goto('/');
  await switchToEnglish(page);
  await page.getByRole('link', { name: 'Create a group' }).click();

  await page.getByLabel('Group name').fill('Natale in ufficio');
  await page.getByLabel('Budget per gift (optional)').fill('20');
  await page.getByLabel('Names').fill('Anna\nMarco\nGiulia');
  await page.getByLabel("I'm playing too").check();
  await page.getByLabel('Which one is you?').selectOption('Marco');
  await page.getByRole('button', { name: 'Create the group' }).click();

  await expect(page.getByTestId('join-code')).toHaveText('ABCD-2345');
  expect(api.created).toEqual({
    name: 'Natale in ufficio',
    budget: 20,
    names: ['Anna', 'Marco', 'Giulia'],
    ownIndex: 1,
  });
  await expect(page).toHaveURL(new RegExp(`#/g/${GROUP_ID}$`));
  await expect(page.getByText('1 of 3 joined')).toBeVisible();
  await expect(page.getByText('Budget: €20.00')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Or scan this QR code' })).toBeVisible();

  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/#\/join\/ABCD2345$/);

  await page.getByRole('button', { name: 'Free this name' }).click();
  await page.getByRole('button', { name: 'Yes, free it' }).click();
  await expect(page.getByText('0 of 3 joined')).toBeVisible();

  await page.getByRole('link', { name: 'Secret Santa' }).click();
  await expect(page.getByText('Organizer and player')).toBeVisible();
});

test('a private organizer link restores access on a new device', async ({ page }) => {
  await mockApi(page);
  await page.goto(`/#/g/${GROUP_ID}?t=${ADMIN}`);
  await expect(page.getByTestId('join-code')).toHaveText('ABCD-2345');
  await expect(page).toHaveURL(new RegExp(`#/g/${GROUP_ID}$`));
  await page.reload();
  await expect(page.getByTestId('join-code')).toHaveText('ABCD-2345');
});
