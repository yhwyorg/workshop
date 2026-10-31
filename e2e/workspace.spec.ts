import { beginStudy, expect, test } from './fixtures';

/**
 * The workspace behaves like an app, not a long web page: the screen stays put, and
 * the Bible and the notes each scroll on their own. A reader of the whole chapter
 * keeps their notes in view; the first version scrolled them away.
 */
test.describe('the workspace', () => {
  test('the page itself never scrolls', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    const overflow = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('reading to the end of the chapter keeps the notes in view', async ({ page }, info) => {
    test.skip(info.project.name === 'phone', 'on a phone the notes are one tap away instead');
    await beginStudy(page, 'John', 15);
    const bible = page.getByRole('region', { name: 'Bible', exact: true });
    const notes = page.getByLabel('Notes', { exact: true });
    await bible.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(page.locator('.scripture .v').last()).toBeInViewport();
    await expect(notes).toBeInViewport();
  });

  test('the toolbar turns the chapter', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await page.getByRole('button', { name: 'Next chapter' }).click();
    await expect(page.getByRole('button', { name: /John 16/ })).toBeVisible();
    await page.getByRole('button', { name: 'Previous chapter' }).click();
    await expect(page.getByRole('button', { name: /John 15/ })).toBeVisible();
  });

  test('on a phone, the Bible and the notes are a tap apart', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'phone only');
    await beginStudy(page, 'John', 15);
    await page.getByRole('tab', { name: 'Notes' }).click();
    await expect(page.getByLabel('Notes', { exact: true })).toBeInViewport();
    await page.getByRole('tab', { name: 'Bible' }).click();
    await expect(page.locator('.scripture')).toBeInViewport();
  });
});

test.describe('the look', () => {
  // The canvas colour as painted: the first of body and html with a background of its
  // own. Reading body alone passed against an earlier design whose body was transparent
  // ("0,0,0,0" read as black).
  const canvas = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      for (const el of [document.body, document.documentElement]) {
        const c = getComputedStyle(el).backgroundColor;
        const n = c.match(/[\d.]+/g)!.map(Number);
        if (n.length === 3 || n[3] > 0) return n.slice(0, 3);
      }
      return [255, 255, 255];
    });

  test('it starts in the Notebook, even when the device is in dark mode', async ({ browser }, info) => {
    // Darrell's notebook and three-colour pen, chosen by the family (Sepia before).
    const context = await browser.newContext({ ...info.project.use, colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto('/#/new');
    await page.getByRole('heading', { name: 'The Holy Bible' }).waitFor();
    // The Notebook's page colour, #f8f8f5.
    expect(await canvas(page)).toEqual([248, 248, 245]);
    await context.close();
  });

  test('"Automatic" follows the device: light by day, dark at night', async ({ browser }, info) => {
    // Two whole browser contexts, light and dark, each opening the app twice: under a
    // full local run (4 workers) it went past 30s on the phone with no step hung
    // (clicks took 2.5-3.5s). Given the time its work needs, not more for everything.
    test.slow();
    const luminance = async (scheme: 'light' | 'dark') => {
      const context = await browser.newContext({ ...info.project.use, colorScheme: scheme });
      const page = await context.newPage();
      await page.goto('/#/paper');
      await page.getByRole('button', { name: /Automatic/ }).click();
      await page.goto('/#/new');
      await page.getByRole('heading', { name: 'The Holy Bible' }).waitFor();
      const rgb = await canvas(page);
      await context.close();
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    };
    expect(await luminance('light')).toBeGreaterThan(180);
    expect(await luminance('dark')).toBeLessThan(60);
  });

  test('it can be added to the Home Screen and open full-screen', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifest = await (await request.get(href!)).json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThan(0);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  });
});
