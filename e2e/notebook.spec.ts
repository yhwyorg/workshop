import type { Page } from '@playwright/test';
import { beginStudy, draw, expect, savedStudies, show, test } from './fixtures';

/**
 * The Notebook paper styles, from photographs of Darrell's notebook: white pages, dotted
 * rules with a solid one every eighth line, a DATE/NO. and TITLE box, and his pens. The
 * main one has the four-colour ballpoint (blue, black, red, green); the other a fountain
 * pen. The Notebook is where everyone starts.
 */
const choose = async (page: Page, name: RegExp) => {
  await page.goto('/#/paper');
  await page.getByRole('button', { name }).click();
};
const noPens = (name: string) => test.skip(name === 'phone', 'a phone has no pens in its toolbar');
/** How far the notes' writing begins below the top of the page: the same in every style, or ink would move. */
const headHeight = (page: Page) =>
  page.evaluate(() => {
    const surface = document.querySelector('.pad-surface')!;
    const lines = document.querySelector('textarea.pad-lines')!;
    // In the page's own pixels, whatever the notepad's zoom.
    return Math.round((lines.getBoundingClientRect().top - surface.getBoundingClientRect().top) / (surface.getBoundingClientRect().width / (surface as HTMLElement).offsetWidth));
  });

test.describe('the Notebook', () => {
  test('heads the page with DATE/NO. and TITLE, as tall as the title and date in any other style', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await expect(page.locator('.pad-label-date')).toHaveText(/date \/ no\./i);
    await expect(page.locator('.pad-label-title')).toBeVisible();
    await expect(page.locator('.pad-date')).toBeVisible();
    // Each label in its own cell: TITLE once sat inside the DATE cell.
    const [date, title, divider] = await page.evaluate(() => [
      document.querySelector('.pad-label-date')!.getBoundingClientRect().left,
      document.querySelector('.pad-label-title')!.getBoundingClientRect().left,
      document.querySelector('.pad-meta')!.getBoundingClientRect().right,
    ]);
    expect(date).toBeLessThan(divider);
    expect(title).toBeGreaterThan(divider);
    const notebook = await headHeight(page);
    await choose(page, /Sepia$/);
    await page.goBack();
    await show(page, 'Notes');
    await expect(page.locator('.pad-label-date')).toBeHidden();
    expect(await headHeight(page)).toBe(notebook);
  });

  test('is ruled in dots, with a solid line every eighth', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    const rules = await page.locator('.pad-surface').evaluate((el) => decodeURIComponent(getComputedStyle(el).backgroundImage));
    expect(rules).toContain('stroke-dasharray');
    expect(rules).toContain("height='256'");
  });

  test('has the four-colour pen: blue, black, red and green, each writing in its own colour', async ({ page }, info) => {
    noPens(info.project.name);
    await beginStudy(page, 'John', 15);
    for (const name of ['Pen', 'Black pen', 'Red pen', 'Green pen']) {
      await expect(page.getByRole('toolbar', { name: 'Study' }).getByRole('button', { name, exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Green pen', exact: true }).click();
    await draw(page, '.pad-surface', 'pen', [60, 160], [260, 170]);
    await expect.poll(async () => (await savedStudies(page))[0]?.ink?.pad?.strokes?.[0]?.tool).toBe('green');
    expect(await page.locator('.pad-surface svg.ink path').evaluate((el) => getComputedStyle(el).fill)).toBe('rgb(29, 122, 60)');
  });
});

test.describe('the Notebook with a fountain pen', () => {
  test('writes in blue-black, with a deep red second pen and no black or green', async ({ page }, info) => {
    noPens(info.project.name);
    await choose(page, /Notebook, fountain pen$/);
    await beginStudy(page, 'John', 15);
    await expect(page.getByRole('button', { name: 'Green pen', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Black pen', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Red pen', exact: true }).click();
    await draw(page, '.pad-surface', 'pen', [60, 160], [260, 170]);
    // Its own red, not its gold accent: the "Red pen" drew in the accent before.
    await expect(page.locator('.pad-surface svg.ink path')).toHaveCount(1);
    expect(await page.locator('.pad-surface svg.ink path').evaluate((el) => getComputedStyle(el).fill)).toBe('rgb(142, 31, 36)');
  });
});
