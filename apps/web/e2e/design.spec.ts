import { expect, test } from '@playwright/test';

test('design showcase loads', async ({ page }) => {
  await page.goto('/#/design');
  await expect(page.getByRole('heading', { name: 'Secret Santa' })).toBeVisible();
});

test('reveal card unlocks only when everyone has joined', async ({ page }) => {
  await page.goto('/#/design');
  const card = page.getByRole('button', { name: /Waiting for everyone to join/ });
  await expect(card).toBeDisabled();

  await page.getByRole('button', { name: 'One joins' }).click();
  await page.getByRole('button', { name: 'One joins' }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5');

  const gift = page.getByRole('button', { name: /Tap to reveal/ });
  await expect(gift).toHaveAttribute('data-state', 'wrapped');
  await gift.click();
  await expect(page.locator('[data-state="opened"]')).toBeVisible();
  await expect(page.getByText('Giulia', { exact: true }).last()).toBeVisible();
});
