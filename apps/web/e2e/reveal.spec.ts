import { expect, test } from '@playwright/test';
import { GROUP_ID, PLAYER, switchToEnglish } from './fixtures';

test('a player waits for everyone, then opens the gift to see their recipient', async ({
  page,
}) => {
  let drawn = false;
  await page.route('http://api.test/functions/v1/get-my-assignment', (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${PLAYER}`);
    return route.fulfill({
      json: {
        groupId: GROUP_ID,
        groupName: 'Natale in famiglia',
        budget: 30,
        status: drawn ? 'drawn' : 'open',
        joined: drawn ? 3 : 2,
        total: 3,
        me: 'Giulia',
        recipient: drawn ? 'Marco' : null,
      },
    });
  });

  await page.goto(`/#/g/${GROUP_ID}/me?t=${PLAYER}`);
  await switchToEnglish(page);
  await expect(page.getByText('Hi Giulia, this is your gift')).toBeVisible();
  await expect(page.getByText('2 of 3 joined')).toBeVisible();
  await expect(page.getByRole('button', { name: /opens when everyone has joined/ })).toBeDisabled();
  // The private link token is kept on the device and leaves the address bar.
  await expect(page).toHaveURL(new RegExp(`#/g/${GROUP_ID}/me$`));

  // Without a live backend here, coming back to the tab refreshes the page instead.
  drawn = true;
  await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
  const gift = page.getByRole('button', { name: /Tap to open your gift/ });
  await expect(gift).toBeEnabled();
  await expect(page.getByText('Marco')).toHaveCount(0);

  await gift.click();
  await expect(page.getByText('You are the Secret Santa of')).toBeVisible();
  await expect(page.getByText('Marco')).toBeVisible();
});
