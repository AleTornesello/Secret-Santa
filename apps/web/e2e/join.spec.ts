import { expect, test, type Page } from '@playwright/test';

const GROUP_ID = '6f1c1f4e-6f0a-4c4e-9a52-1f9a7e0b8c11';

/** A tiny in-browser stand-in for the API: three names, Anna already taken. */
async function mockApi(page: Page) {
  const taken = new Set(['Anna']);
  await page.route('http://api.test/functions/v1/*', async (route) => {
    const name = route.request().url().split('/').at(-1);
    const body = route.request().postDataJSON() as { code: string; participantId?: string };
    if (body.code !== 'ABCD2345')
      return route.fulfill({ status: 404, json: { error: 'not_found' } });
    if (name === 'join-group') {
      if (taken.has(String(body.participantId))) {
        return route.fulfill({ status: 409, json: { error: 'already_taken' } });
      }
      taken.add(String(body.participantId));
      return route.fulfill({
        json: {
          groupId: GROUP_ID,
          participantId: body.participantId,
          playerToken: 'p'.repeat(43),
          status: 'open',
        },
      });
    }
    return route.fulfill({
      json: {
        id: GROUP_ID,
        name: 'Natale in famiglia',
        budget: 30,
        status: 'open',
        joinDeadline: new Date(Date.now() + 3_600_000).toISOString(),
        joined: taken.size,
        total: 3,
        participants: ['Anna', 'Giulia', 'Marco'].map((n) => ({
          id: n,
          name: n,
          taken: taken.has(n),
        })),
      },
    });
  });
}

test('a friend opens the join link, picks their name and gets their private link', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/#/join/ABCD2345');
  await page.getByRole('combobox', { name: /Language|Lingua/ }).selectOption('en');

  await expect(page.getByRole('heading', { name: 'Natale in famiglia' })).toBeVisible();
  await expect(page.getByText('1 of 3 joined')).toBeVisible();
  await expect(page.getByRole('radio', { name: /Anna/ })).toBeDisabled();

  await page.getByText('Giulia', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: "Yes, I'm Giulia" }).click();

  await expect(page.getByRole('heading', { name: "You're in, Giulia!" })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Save your player link' })).toBeVisible();

  // Opening the same link again on this device does not offer the names again.
  await page.reload();
  await expect(page.getByText('This device already joined this group as Giulia.')).toBeVisible();

  await page.goto('/#/');
  await expect(page.getByText('Natale in famiglia')).toBeVisible();
  await expect(page.getByRole('link', { name: 'My recipient' })).toBeVisible();
});

test('a friend types the code on the home page', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/');
  await page.getByRole('combobox', { name: /Language|Lingua/ }).selectOption('en');
  await page.getByLabel('Join code').fill('abcd-2345');
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page).toHaveURL(/#\/join\/ABCD2345$/);
  await expect(page.getByRole('heading', { name: 'Natale in famiglia' })).toBeVisible();
});

test('a wrong code says so', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/join/ZZZZ2222');
  await page.getByRole('combobox', { name: /Language|Lingua/ }).selectOption('en');
  await expect(page.getByRole('alert')).toHaveText(
    'No group has this code. Check it with the organizer.',
  );
});
