import type { Page } from '@playwright/test';
import { beginStudy, draw, expect, savedBible, savedStudies, test } from './fixtures';

/**
 * The margin: room to write beside the verses, kept in the reader's one Bible. The user
 * asked to "put notes in there next to the verses" that "carry through the study
 * sessions", on a page for older pastors, so it is a button that says what it does, the
 * reading page is unchanged until it is pressed, and notes never vanish unannounced.
 */
const button = (page: Page) => page.getByRole('button', { name: 'Margin', exact: true });
const margin = (page: Page) => page.locator('.bible-margin');
const strokes = async (page: Page) => (await savedBible(page)).ink['margin:15']?.strokes.length;
const noPhone = (name: string) => test.skip(name === 'phone', 'a phone has no room beside the text');

test.describe('the margin', () => {
  test('opens beside the text; the text keeps its line breaks, and stays large enough to read', async ({ page }, info) => {
    noPhone(info.project.name);
    await beginStudy(page, 'John', 15);
    await expect(margin(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show your margin notes' })).toHaveCount(0);
    const lines = () => page.locator('.bible-text').evaluate((el) => ({
      width: (el as HTMLElement).offsetWidth,
      height: (el as HTMLElement).offsetHeight,
    }));
    const before = await lines();
    const shown = (await page.locator('.bible-text').boundingBox())!;
    await button(page).click();
    await expect(button(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(margin(page)).toBeInViewport();
    await expect(margin(page)).toContainText('Write here');
    // The same width and height: not a word has moved within the text.
    expect(await lines()).toEqual(before);
    await expect.poll(async () => {
      const [t, m] = [(await page.locator('.bible-text').boundingBox())!, (await margin(page).boundingBox())!];
      return m.x >= t.x + t.width - 1 && t.width >= shown.width * 0.8;
    }).toBe(true);
  });

  test('what is written there carries to the next study of the chapter', async ({ page }, info) => {
    noPhone(info.project.name);
    await beginStudy(page, 'John', 15);
    await button(page).click();
    await draw(page, '.bible-margin', 'pen', [20, 120], [150, 130]);
    await expect.poll(() => strokes(page)).toBe(1);
    await expect(margin(page)).not.toContainText('Write here');
    await beginStudy(page, 'John', 15);
    await expect.poll(async () => (await savedStudies(page)).length).toBe(2);
    await expect(margin(page).locator('svg.ink path')).toHaveCount(1);
  });

  test('a finger writes there, until a Pencil has been used; on the text it still does not', async ({ page }, info) => {
    noPhone(info.project.name);
    await beginStudy(page, 'John', 15);
    await button(page).click();
    await draw(page, '.bible-text', 'touch', [40, 40], [200, 40]);
    await draw(page, '.bible-margin', 'touch', [20, 120], [150, 130]);
    await expect.poll(() => strokes(page)).toBe(1);
    expect((await savedBible(page)).ink['15']).toBeUndefined();
    // A palm resting on the glass mustn't write once he has picked up the Pencil.
    await draw(page, '.bible-margin', 'pen', [20, 180], [150, 190]);
    await expect.poll(() => strokes(page)).toBe(2);
    await draw(page, '.bible-margin', 'touch', [20, 240], [150, 250]);
    await page.waitForTimeout(300);
    expect(await strokes(page)).toBe(2);
  });

  test('a mouse writes there with no pen to choose first', async ({ page }, info) => {
    noPhone(info.project.name);
    await beginStudy(page, 'John', 15);
    await button(page).click();
    await draw(page, '.bible-margin', 'mouse', [20, 120], [150, 130]);
    await expect.poll(() => strokes(page)).toBe(1);
  });

  test('undo takes back what was written there', async ({ page }, info) => {
    noPhone(info.project.name);
    await beginStudy(page, 'John', 15);
    await button(page).click();
    await draw(page, '.bible-margin', 'pen', [20, 120], [150, 130]);
    await expect(margin(page).locator('svg.ink path')).toHaveCount(1);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(margin(page).locator('svg.ink path')).toHaveCount(0);
    await expect.poll(() => strokes(page)).toBeUndefined();
  });

  test('closed, it says the chapter has notes there, and one tap brings them back', async ({ page }, info) => {
    noPhone(info.project.name);
    // A margin that closes over notes, with no word about it, would read as notes lost.
    await beginStudy(page, 'John', 15);
    await button(page).click();
    await draw(page, '.bible-margin', 'pen', [20, 120], [150, 130]);
    await expect.poll(() => strokes(page)).toBe(1);
    await button(page).click();
    await expect(margin(page)).toHaveCount(0);
    const show = page.getByRole('button', { name: 'Show your margin notes' });
    await expect(show).toBeInViewport();
    await show.click();
    await expect(margin(page).locator('svg.ink path')).toHaveCount(1);
    await expect(show).toHaveCount(0);
    // Another chapter has none, and says nothing.
    await button(page).click();
    await page.getByRole('button', { name: 'Next chapter' }).click();
    await expect(page.locator('.scripture').first()).toBeVisible();
    await expect(show).toHaveCount(0);
  });

  test('stays open or closed as it was left', async ({ page }, info) => {
    noPhone(info.project.name);
    await beginStudy(page, 'John', 15);
    await button(page).click();
    await expect(margin(page)).toBeInViewport();
    await page.reload();
    await expect(page.locator('.scripture')).toBeVisible();
    await expect(margin(page)).toBeInViewport();
  });

  test('a Pencil tap while looking up the Greek writes nothing there', async ({ page }, info) => {
    noPhone(info.project.name);
    await beginStudy(page, 'John', 15);
    await button(page).click();
    await page.getByRole('button', { name: 'Greek', exact: true }).click();
    await draw(page, '.bible-margin', 'pen', [20, 120], [150, 130]);
    await page.waitForTimeout(300);
    expect(await strokes(page)).toBeUndefined();
  });

  test('a phone has no margin to open, and says where its notes can be seen', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'phone only');
    await beginStudy(page, 'John', 15);
    await expect(button(page)).toHaveCount(0);
    await expect.poll(async () => (await savedStudies(page)).length).toBe(1);
    await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem('workshop:store')!);
      store.bible = { JOH: { marks: {}, ink: { 'margin:15': { width: 180, layout: 2, strokes: [{ tool: 'pen', pts: [10, 10, 0.5, 60, 12, 0.5] }] } } } };
      localStorage.setItem('workshop:store', JSON.stringify(store));
    });
    await page.reload();
    await expect(page.getByText('This chapter has notes in its margin')).toBeVisible();
  });
});
