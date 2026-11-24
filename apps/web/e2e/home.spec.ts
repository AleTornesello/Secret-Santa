import { expect, test } from '@playwright/test';

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Secret Santa' })).toBeVisible();
});

test('reveal card unlocks only when everyone has joined', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('button', { name: /Waiting for everyone to join/ });
  await expect(card).toBeDisabled();

  await page.getByRole('button', { name: 'One joins' }).click();
  await page.getByRole('button', { name: 'One joins' }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5');

  await page.getByRole('button', { name: /Tap to reveal/ }).click();
  await expect(page.getByText('Giulia', { exact: true }).last()).toBeVisible();
});
