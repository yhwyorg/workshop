import type { Page } from '@playwright/test';
import { beginStudy, compareWith, draw, expect, recordedApi, show, test } from './fixtures';

/**
 * Bible | references | notes. Opening a translation or a commentary adds a column
 * beside the Bible; the notes never leave the screen (they used to give up their place
 * to the reference, a tab away). On a phone there is no room, so panes stay a tab apart.
 */
const notPhone = (name: string) => test.skip(name === 'phone', 'a phone shows one pane at a time');

/** Puts the start of a verse at the top of its pane. */
async function scrollToVerse(page: Page, pane: string, verse: number) {
  await page.getByRole('region', { name: pane, exact: true }).evaluate((el, v) => {
    const target = el.querySelector(`[data-verse="${v}"]`)!;
    el.scrollTop += target.getBoundingClientRect().top - el.getBoundingClientRect().top;
  }, verse);
}

/** How far the verse's start sits below the top of its pane, in pixels. */
const verseOffset = (page: Page, pane: string, verse: number) =>
  page.getByRole('region', { name: pane, exact: true }).evaluate(
    (el, v) => Math.round(el.querySelector(`[data-verse="${v}"]`)!.getBoundingClientRect().top - el.getBoundingClientRect().top),
    verse,
  );

test.describe('references in columns', () => {
  test('the notes stay on screen when a reference opens', async ({ page }, info) => {
    notPhone(info.project.name);
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'King James Version');
    await expect(page.getByRole('region', { name: 'King James Version', exact: true })).toContainText('husbandman');
    await expect(page.locator('.scripture')).toBeInViewport();
    await expect(page.getByRole('region', { name: 'Your notes', exact: true })).toBeInViewport();
    await expect(page.getByLabel('Notes', { exact: true })).toBeInViewport();
  });

  test('more than one reference can be open at once', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'King James Version');
    await compareWith(page, 'Berean Standard Bible');
    await compareWith(page, 'Matthew Henry');
    await show(page, 'KJV');
    await expect(page.getByRole('region', { name: 'King James Version', exact: true })).toContainText('husbandman');
    await show(page, 'BSB');
    await expect(page.getByRole('region', { name: 'Berean Standard Bible', exact: true })).toContainText('keeper of the vineyard');
    await show(page, 'Henry');
    await expect(page.getByRole('region', { name: 'Matthew Henry', exact: true })).toContainText('Here Christ discourses');
  });

  test('closing one reference leaves the others', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'King James Version');
    await compareWith(page, 'Berean Standard Bible');
    await show(page, 'KJV');
    await page.getByRole('button', { name: 'Close King James Version' }).click();
    await expect(page.getByRole('region', { name: 'King James Version', exact: true })).toHaveCount(0);
    await show(page, 'BSB');
    await expect(page.getByRole('region', { name: 'Berean Standard Bible', exact: true })).toContainText('keeper of the vineyard');
  });

  test('every reference chosen is still there after a reload', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'King James Version');
    await compareWith(page, 'Berean Standard Bible');
    await page.reload();
    await show(page, 'BSB');
    await expect(page.getByRole('region', { name: 'Berean Standard Bible', exact: true })).toContainText('keeper of the vineyard');
    await show(page, 'KJV');
    await expect(page.getByRole('region', { name: 'King James Version', exact: true })).toContainText('husbandman');
  });
});

test.describe('scrolling together', () => {
  test('locked, scrolling the Bible brings the reference to the same verse', async ({ page }, info) => {
    notPhone(info.project.name);
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'King James Version');
    await expect(page.getByRole('region', { name: 'King James Version', exact: true })).toContainText('husbandman');
    await expect(page.getByRole('button', { name: 'Scroll together' })).toHaveAttribute('aria-pressed', 'true');
    await scrollToVerse(page, 'Bible', 10);
    await expect.poll(async () => Math.abs(await verseOffset(page, 'King James Version', 10))).toBeLessThan(30);
  });

  test('the Bible and the Berean Standard Bible are told apart', async ({ page }, info) => {
    // "Bible" is inside "Berean Standard Bible"; a name matched as a substring found two
    // panes (seen checking the live site after #10).
    notPhone(info.project.name);
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'Berean Standard Bible');
    await expect(page.getByRole('region', { name: 'Berean Standard Bible', exact: true })).toContainText('keeper of the vineyard');
    await scrollToVerse(page, 'Bible', 10);
    await expect.poll(async () => Math.abs(await verseOffset(page, 'Berean Standard Bible', 10))).toBeLessThan(30);
  });

  test('locked, scrolling the reference brings the Bible along too', async ({ page }, info) => {
    notPhone(info.project.name);
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'King James Version');
    await expect(page.getByRole('region', { name: 'King James Version', exact: true })).toContainText('husbandman');
    await scrollToVerse(page, 'King James Version', 9);
    await expect.poll(async () => Math.abs(await verseOffset(page, 'Bible', 9))).toBeLessThan(30);
  });

  test('a commentary follows to the note that covers the verse', async ({ page }, info) => {
    notPhone(info.project.name);
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'Matthew Henry');
    await expect(page.getByRole('region', { name: 'Matthew Henry', exact: true })).toContainText('Here Christ discourses');
    // Henry's notes begin at verses 1, 9, 18 and 26; verse 12 is in the note at 9.
    await scrollToVerse(page, 'Bible', 12);
    await expect.poll(async () => Math.abs(await verseOffset(page, 'Matthew Henry', 9))).toBeLessThan(30);
  });

  test('unlocked, each column scrolls on its own', async ({ page }, info) => {
    notPhone(info.project.name);
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'King James Version');
    await expect(page.getByRole('region', { name: 'King James Version', exact: true })).toContainText('husbandman');
    await page.getByRole('button', { name: 'Scroll together' }).click();
    await scrollToVerse(page, 'Bible', 10);
    await page.waitForTimeout(300);
    expect(await page.getByRole('region', { name: 'King James Version', exact: true }).evaluate((el) => el.scrollTop)).toBe(0);
  });
});

test.describe('ink when the Bible makes room', () => {
  // The Bible's text is laid out at one width and shrinks as a whole to make room, so
  // its lines never rewrap and ink stays on the words it was written on.
  const overlaps = (page: Page, word: string) =>
    page.evaluate((word) => {
      const w = [...document.querySelectorAll('.bible-text .word')].find((b) => b.textContent === word)!.getBoundingClientRect();
      const p = document.querySelector('.bible-text svg.ink path')!.getBoundingClientRect();
      return p.left < w.right && p.right > w.left && p.top < w.bottom && p.bottom > w.top;
    }, word);

  test('ink written before a reference opens is still on its word after', async ({ page }, info) => {
    notPhone(info.project.name);
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    const word = (await page.getByRole('button', { name: 'farmer.', exact: true }).boundingBox())!;
    const surface = (await page.locator('.bible-text').boundingBox())!;
    const at: [number, number] = [word.x - surface.x + 4, word.y - surface.y + word.height / 2];
    await draw(page, '.bible-text', 'pen', at, [at[0] + word.width - 8, at[1]]);
    expect(await overlaps(page, 'farmer.')).toBe(true);
    await compareWith(page, 'King James Version');
    await expect(page.getByRole('region', { name: 'King James Version', exact: true })).toContainText('husbandman');
    expect(await overlaps(page, 'farmer.')).toBe(true);
  });

  test('ink written while a reference is open lands under the pen', async ({ page }, info) => {
    notPhone(info.project.name);
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'King James Version');
    await expect(page.getByRole('region', { name: 'King James Version', exact: true })).toContainText('husbandman');
    const word = (await page.getByRole('button', { name: 'farmer.', exact: true }).boundingBox())!;
    const surface = (await page.locator('.bible-text').boundingBox())!;
    const at: [number, number] = [word.x - surface.x + 4, word.y - surface.y + word.height / 2];
    await draw(page, '.bible-text', 'pen', at, [at[0] + word.width - 8, at[1]]);
    expect(await overlaps(page, 'farmer.')).toBe(true);
    await page.getByRole('button', { name: 'Close King James Version' }).click();
    expect(await overlaps(page, 'farmer.')).toBe(true);
  });
});
