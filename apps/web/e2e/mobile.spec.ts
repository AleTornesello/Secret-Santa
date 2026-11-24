import { expect, test, type Page } from '@playwright/test';
import { ADMIN, GROUP_ID, groupView } from './fixtures';
const PAGES = ['/#/', '/#/new', `/#/g/${GROUP_ID}`, '/#/join/ABCD2345', '/#/design'];

async function mockApi(page: Page) {
  await page.route('http://api.test/functions/v1/*', (route) =>
    route.fulfill({
      json: groupView(
        ['Anna Maria Bianchi Rossi', 'Marco', 'Giulia'],
        new Set(['Anna Maria Bianchi Rossi']),
        {
          name: 'Natale in ufficio con i colleghi del terzo piano',
        },
      ),
    }),
  );
  await page.goto('/#/');
  await page.evaluate(
    ([id, token]) =>
      localStorage.setItem(
        'secret-santa:groups',
        JSON.stringify([{ groupId: id, name: 'Natale', adminToken: token, savedAt: '' }]),
      ),
    [GROUP_ID, ADMIN],
  );
}

// The smallest phones still in use are 320px wide; 360 and 390 are the most common.
for (const width of [320, 360, 390]) {
  test.describe(`at ${width}px wide`, () => {
    test.use({ viewport: { width, height: 740 }, hasTouch: true, isMobile: true });

    for (const path of PAGES) {
      test(`${path} fits the screen and has touch-sized controls`, async ({ page }) => {
        await mockApi(page);
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, 'no horizontal scrolling').toBeLessThanOrEqual(0);

        // Every button, field and select is at least 40px tall, so it is easy to tap. Checkboxes
        // and radios are tapped through their label, so the label is measured instead.
        const small = await page
          .locator(
            'button, input:not([type="checkbox"]):not([type="radio"]), select, textarea, label:has(input[type="checkbox"], input[type="radio"])',
          )
          .evaluateAll((elements) =>
            elements
              .filter((el) => (el as HTMLElement).offsetParent !== null)
              .map((el) => ({
                text: el.textContent || el.getAttribute('aria-label') || el.tagName,
                height: el.getBoundingClientRect().height,
              }))
              .filter((el) => el.height < 40),
          );
        expect(small, 'controls shorter than 40px').toEqual([]);
      });
    }
  });
}
