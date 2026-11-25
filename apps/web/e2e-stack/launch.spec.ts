import { devices, expect, test, type Browser, type Page } from '@playwright/test';
import { routeToStackFunctions } from './stack';

const NAMES = ['Alice', 'Bruno', 'Chiara'];
const PHONE = devices['Pixel 7'];

/** A phone of its own: a fresh browser context, in English. */
async function newPlayer(browser: Browser, path: string): Promise<Page> {
  const context = await browser.newContext({
    viewport: PHONE.viewport,
    userAgent: PHONE.userAgent,
    deviceScaleFactor: PHONE.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
  });
  await routeToStackFunctions(context);
  await context.addInitScript(() => localStorage.setItem('secret-santa:locale', 'en'));
  const page = await context.newPage();
  await page.goto(path);
  return page;
}

async function pickName(page: Page, name: string) {
  await page.getByText(name, { exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: `Yes, I'm ${name}` }).click();
  await expect(page.getByRole('heading', { name: `You're in, ${name}!` })).toBeVisible();
  await page.getByRole('link', { name: 'Go to my recipient' }).click();
}

async function openGift(page: Page): Promise<string> {
  await page.getByRole('button', { name: /Tap to open your gift/ }).click();
  const recipient = page.locator('[data-state="opened"] [aria-live] > span').last();
  await expect(recipient).toBeVisible();
  return (await recipient.textContent()) ?? '';
}

test('three friends play a whole round on the real stack, live', async ({ browser }) => {
  // The organizer creates the group and plays as Alice.
  const organizer = await newPlayer(browser, '/#/new');
  await organizer.getByLabel('Group name').fill('Launch party');
  await organizer.getByLabel('Budget per gift (optional)').fill('15');
  await organizer.getByLabel('Names').fill(NAMES.join('\n'));
  await organizer.getByLabel("I'm playing too").check();
  await organizer.getByLabel('Which one is you?').selectOption('Alice');
  await organizer.getByRole('button', { name: 'Create the group' }).click();
  await expect(organizer.getByText('1 of 3 joined')).toBeVisible();
  const code = ((await organizer.getByTestId('join-code').textContent()) ?? '').replace('-', '');
  expect(code).toMatch(/^[A-Z2-9]{8}$/);
  const groupId = /#\/g\/([0-9a-f-]+)/.exec(organizer.url())?.[1];

  // Alice also keeps her own page open: it stays locked while people join.
  const alice = await organizer.context().newPage();
  await alice.goto(`/#/g/${groupId}/me`);
  await expect(alice.getByText('1 of 3 joined')).toBeVisible();
  await expect(alice.getByRole('button', { name: /opens when everyone/ })).toBeDisabled();

  // Bruno opens the join link.
  const bruno = await newPlayer(browser, `/#/join/${code}`);
  await pickName(bruno, 'Bruno');
  await expect(bruno.getByText('2 of 3 joined')).toBeVisible();

  // Every open screen moves on without a reload.
  await expect(organizer.getByText('2 of 3 joined')).toBeVisible();
  await expect(alice.getByText('2 of 3 joined')).toBeVisible();

  // Chiara types the code on the home page; her claim is the last one and draws the names.
  const chiara = await newPlayer(browser, '/#/');
  await chiara.getByLabel('Join code').fill(code.toLowerCase());
  await chiara.getByRole('button', { name: 'Join' }).click();
  await pickName(chiara, 'Chiara');

  await expect(
    organizer.getByText('Everyone has joined and the names have been drawn.'),
  ).toBeVisible();
  const players = { Alice: alice, Bruno: bruno, Chiara: chiara };
  const recipients: Record<string, string> = {};
  for (const [name, page] of Object.entries(players)) {
    await expect(page.getByText('3 of 3 joined')).toBeVisible();
    recipients[name] = await openGift(page);
    expect(recipients[name]).not.toBe(name);
  }
  // One single cycle: everyone gives once and receives once.
  expect(Object.values(recipients).sort()).toEqual([...NAMES].sort());

  // Bruno's private link restores his page on another phone.
  const token = await bruno.evaluate(
    (id) =>
      (
        JSON.parse(localStorage.getItem('secret-santa:groups') ?? '[]') as Record<string, string>[]
      ).find((group) => group.groupId === id)?.playerToken,
    groupId,
  );
  const otherPhone = await newPlayer(browser, `/#/g/${groupId}/me?t=${token}`);
  await expect(otherPhone.getByText('Hi Bruno, this is your gift')).toBeVisible();
  expect(await openGift(otherPhone)).toBe(recipients.Bruno);
});
