import type { Page } from '@playwright/test';
import { beginStudy, draw, expect, savedStudies, show, test, typeNotes } from './fixtures';

/**
 * More than one page of notes. The user, trying it on a real iPad: "multiple pages of
 * notes, you know, add another page and then flip between them, and pagination".
 */
// The page on screen; the other pages are kept in the document for printing.
const SURFACE = '.pad-surface:not(.print-page)';
const notes = (page: Page) => page.getByLabel('Notes', { exact: true });
const add = (page: Page) => page.getByRole('button', { name: 'Add a page', exact: true });
const next = (page: Page) => page.getByRole('button', { name: 'Next page', exact: true });
const back = (page: Page) => page.getByRole('button', { name: 'Previous page', exact: true });
const which = (page: Page) => page.getByLabel('Which page', { exact: true });
const inkOn = (page: Page) => page.locator(`${SURFACE} svg.ink path`);

test.describe('pages of notes', () => {
  test('one page stays as it was: no page numbers until there is a second', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await expect(add(page)).toBeVisible();
    await expect(next(page)).toHaveCount(0);
    await expect(which(page)).toHaveCount(0);
    await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
  });

  test('a new page is blank, and flipping keeps each page’s typing and writing to itself', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await typeNotes(page, 'The first page.');
    await draw(page, SURFACE, 'pen', [60, 240], [260, 250]);
    await expect(inkOn(page)).toHaveCount(1);
    await add(page).click();
    await expect(which(page)).toHaveValue('2');
    await expect(which(page)).toContainText('Page 2 of 2');
    await expect(notes(page)).toHaveValue('');
    await expect(inkOn(page)).toHaveCount(0);
    await typeNotes(page, 'The second page.');
    await draw(page, SURFACE, 'pen', [60, 240], [260, 250]);
    await draw(page, SURFACE, 'pen', [60, 280], [260, 290]);
    await expect(inkOn(page)).toHaveCount(2);

    await back(page).click();
    await expect(notes(page)).toHaveValue('The first page.');
    await expect(inkOn(page)).toHaveCount(1);
    await next(page).click();
    await expect(notes(page)).toHaveValue('The second page.');
    await expect(inkOn(page)).toHaveCount(2);

    await expect.poll(async () => {
      const s = (await savedStudies(page))[0];
      return [s.notes.page, s.notePages, s.ink.pad.strokes.length, s.ink['pad:2'].strokes.length];
    }).toEqual(['The first page.', ['The second page.'], 1, 2]);
  });

  test('turning back a page doesn’t fold the notepad', async ({ page }, info) => {
    test.skip(info.project.name === 'phone', 'a phone has no fold');
    // The fold button sat over "Previous page" and took its taps.
    await beginStudy(page, 'John', 15);
    await add(page).click();
    await back(page).click();
    await expect(which(page)).toHaveValue('1');
    await expect(page.getByRole('button', { name: 'Fold the notepad' })).toBeVisible();
    const [fold, previous] = [(await page.getByRole('button', { name: 'Fold the notepad' }).boundingBox())!, (await back(page).boundingBox())!];
    expect(previous.x).toBeGreaterThanOrEqual(fold.x + fold.width - 1);
  });

  test('the first and last pages have nowhere further to flip', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await add(page).click();
    await expect(next(page)).toBeDisabled();
    await back(page).click();
    await expect(back(page)).toBeDisabled();
  });

  test('any page can be gone to directly', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await typeNotes(page, 'One.');
    await add(page).click();
    await typeNotes(page, 'Two.');
    await add(page).click();
    await typeNotes(page, 'Three.');
    await which(page).selectOption('1');
    await expect(notes(page)).toHaveValue('One.');
  });

  test('adding when the last page is still blank goes there, rather than piling up blanks', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await add(page).click();
    await back(page).click();
    await add(page).click();
    await expect(which(page)).toContainText('Page 2 of 2');
  });

  test('stays on the page it was left on, and another study starts on its own first page', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await typeNotes(page, 'One.');
    await add(page).click();
    await typeNotes(page, 'Two.');
    await expect.poll(async () => (await savedStudies(page))[0]?.notePages?.[0]).toBe('Two.');
    await page.reload();
    await show(page, 'Notes');
    await expect(notes(page)).toHaveValue('Two.');
    await beginStudy(page, 'Mark', 4);
    await show(page, 'Notes');
    await expect(notes(page)).toHaveValue('');
    await expect(which(page)).toHaveCount(0);
  });

  test('typing with no box chosen lands on the page on screen', async ({ page }, info) => {
    test.skip(info.project.name === 'phone', 'typing brings up the notes there, and is covered elsewhere');
    await beginStudy(page, 'John', 15);
    await typeNotes(page, 'One.');
    await add(page).click();
    await page.getByRole('button', { name: 'Write', exact: true }).click();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.type('Two');
    await expect(notes(page)).toHaveValue('Two');
    await back(page).click();
    await expect(notes(page)).toHaveValue('One.');
  });

  test('undo turns to the page it changes, so it can be seen to work', async ({ page }, info) => {
    test.skip(info.project.name === 'phone', 'a phone has no Undo');
    // Undoing on a page out of sight would look like nothing happening.
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await add(page).click();
    await draw(page, SURFACE, 'pen', [60, 240], [260, 250]);
    await expect(inkOn(page)).toHaveCount(1);
    await back(page).click();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(which(page)).toHaveValue('2');
    await expect(inkOn(page)).toHaveCount(0);
  });

  test('the page controls stay in reach far down a long page', async ({ page }, info) => {
    await beginStudy(page, 'John', 15);
    await typeNotes(page, Array.from({ length: 120 }, (_, i) => `Line ${i}`).join('\n'));
    await page.locator('.notes-pane').evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect(add(page)).toBeInViewport();
    // And it doesn't hide the fold button, in the same corner.
    if (info.project.name !== 'phone') await page.getByRole('button', { name: 'Fold the notepad' }).click({ trial: true });
  });

  test('the page controls stay the same size however far the notepad is zoomed', async ({ page }) => {
    // Inside the zoom, an upright iPad made them 1.8 times too big: a quarter of the room.
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await add(page).click();
    expect((await next(page).boundingBox())!.height).toBeLessThan(50);
    expect((await page.locator('.notes-bar').boundingBox())!.height).toBeLessThan(110);
  });

  test('a flip starts at the top of the page', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await typeNotes(page, Array.from({ length: 120 }, (_, i) => `Line ${i}`).join('\n'));
    await page.locator('.notes-pane').evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await add(page).click();
    await expect.poll(() => page.locator('.notes-pane').evaluate((el) => el.scrollTop)).toBe(0);
  });

  test('a page can be removed, after asking if it has writing; the first stays', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await typeNotes(page, 'One.');
    await expect(page.getByRole('button', { name: 'Remove this page' })).toHaveCount(0);
    await add(page).click();
    await typeNotes(page, 'Two.');
    await add(page).click();
    await typeNotes(page, 'Three.');
    await back(page).click();
    let asked = '';
    page.once('dialog', (d) => {
      asked = d.message();
      void d.dismiss();
    });
    await page.getByRole('button', { name: 'Remove this page' }).click();
    expect(asked).toContain('Page 2');
    await expect(notes(page)).toHaveValue('Two.');
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Remove this page' }).click();
    await expect(notes(page)).toHaveValue('Three.');
    await expect(which(page)).toContainText('Page 2 of 2');
    await expect.poll(async () => (await savedStudies(page))[0]?.notePages).toEqual(['Three.']);
  });

  test('a blank page goes without asking', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await add(page).click();
    await page.getByRole('button', { name: 'Remove this page' }).click();
    await expect(which(page)).toHaveCount(0);
  });

  test('printing the notes prints every page, in order, not only the one on screen', async ({ page }) => {
    // One page on paper out of three would read as the rest having been lost.
    await beginStudy(page, 'John', 15);
    await typeNotes(page, 'Page one words.');
    await add(page).click();
    await typeNotes(page, 'Page two words.');
    await draw(page, SURFACE, 'pen', [60, 240], [260, 250]);
    await add(page).click();
    await typeNotes(page, 'Page three words.');
    await back(page).click();
    await page.emulateMedia({ media: 'print' });
    const printed = page.locator('.notes-col .print-text');
    await expect(printed.filter({ visible: true })).toHaveCount(3);
    expect(await printed.allInnerTexts()).toEqual(['Page one words.', 'Page two words.', 'Page three words.']);
    await expect(page.locator('.notes-col .pad-surface svg.ink path').filter({ visible: true })).toHaveCount(1);
    await expect(add(page)).toBeHidden();
  });
});
