import type { Page } from '@playwright/test';
import { beginStudy, draw, expect, savedStudies, show, test } from './fixtures';

/**
 * The Notebook paper styles, from photographs of Darrell's notebook: white pages, dotted
 * rules with a solid one every eighth line, a DATE/NO. and TITLE box, and his pens. The
 * main one has his favourite, a blue three-colour ballpoint (blue, black, red); the other
 * a fountain pen. The Notebook is where everyone starts.
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

  test('has his three-colour pen: blue, black and red, each writing in its own colour', async ({ page }, info) => {
    noPens(info.project.name);
    await beginStudy(page, 'John', 15);
    for (const name of ['Pen', 'Black pen', 'Red pen']) {
      await expect(page.getByRole('toolbar', { name: 'Study' }).getByRole('button', { name, exact: true })).toBeVisible();
    }
    // Three colours, not four: the green first drawn isn't on his pen.
    await expect(page.getByRole('button', { name: 'Green pen', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Black pen', exact: true }).click();
    await draw(page, '.pad-surface', 'pen', [60, 160], [260, 170]);
    await expect.poll(async () => (await savedStudies(page))[0]?.ink?.pad?.strokes?.[0]?.tool).toBe('black');
    expect(await page.locator('.pad-surface svg.ink path').evaluate((el) => getComputedStyle(el).fill)).toBe('rgb(27, 28, 30)');
  });
});

test.describe('the pen, drawn in the toolbar', () => {
  test('the three-colour pen is the colour picker: a colour chosen clicks its slider down', async ({ page }, info) => {
    noPens(info.project.name);
    await beginStudy(page, 'John', 15);
    const pen = page.getByRole('group', { name: 'Three-colour pen' });
    await expect(pen).toBeVisible();
    // Its colours are its sliders, not dots beside it.
    await expect(page.locator('.tb-pens .nib-red')).toHaveCount(0);
    await expect(pen.getByRole('button')).toHaveCount(3);
    const red = pen.getByRole('button', { name: 'Red pen', exact: true });
    await red.click();
    await expect(red).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => red.locator('.bic-tab').evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');
  });

  test('the fountain pen style draws its fountain pen, which is its pen', async ({ page }, info) => {
    noPens(info.project.name);
    await choose(page, /Notebook, fountain pen$/);
    await beginStudy(page, 'John', 15);
    const pen = page.getByRole('button', { name: 'Pen', exact: true });
    await expect(pen).toHaveClass(/fountain/);
    await pen.click();
    await expect(pen).toHaveAttribute('aria-pressed', 'true');
  });

  test('a style with no pen of its own keeps the plain pens', async ({ page }, info) => {
    noPens(info.project.name);
    await choose(page, /Sepia$/);
    await beginStudy(page, 'John', 15);
    await expect(page.locator('.pen-art')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Red pen', exact: true }).locator('.nib-red')).toBeVisible();
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
