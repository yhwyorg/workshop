import type { Page } from '@playwright/test';
import { beginStudy, draw, expect, savedStudies, show, test } from './fixtures';

/**
 * A phone is for reading and for typing a quick note. Measured on the live site before
 * this: a finger's swipe to scroll the notes drew a line instead, and a phone's toolbar
 * has no Undo or eraser, so the line could never be taken off.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) >= 600, 'phone only');

const notes = (page: Page) => page.getByLabel('Notes', { exact: true });
const strokes = async (page: Page) => (await savedStudies(page))[0]?.ink?.pad?.strokes?.length ?? 0;

test.describe('the notes on a phone', () => {
  test('a swipe scrolls them, and leaves no mark', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'touch', [60, 100], [70, 300]);
    await page.waitForTimeout(400);
    expect(await strokes(page)).toBe(0);
    await expect(notes(page)).not.toBeFocused();
    const surface = page.locator('.pad-surface:not(.print-page)');
    // The browser only scrolls for a finger if neither of these stops it.
    expect(await surface.evaluate((el) => getComputedStyle(el).touchAction)).not.toBe('none');
    const carriedOn = await surface.evaluate((el) => el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true })));
    expect(carriedOn).toBe(true);
  });

  test('a mouse in a window this narrow doesn’t write either: there is no Undo here', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'mouse', [60, 200], [260, 210]);
    await page.waitForTimeout(400);
    expect(await strokes(page)).toBe(0);
  });

  test('says what a tap does, and doesn’t offer handwriting', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await expect(notes(page)).toHaveAttribute('placeholder', 'Tap to type…');
  });

  test('a tap still brings the keyboard', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'touch', [80, 200], [81, 201]);
    await expect(notes(page)).toBeFocused();
    await page.keyboard.type('Abide.');
    await expect(notes(page)).toHaveValue('Abide.');
    expect(await strokes(page)).toBe(0);
  });

  test('ink written on an iPad and brought over in a backup still shows', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem('workshop:store')!);
      store.pads[0].ink = { pad: { width: 460, strokes: [{ tool: 'pen', pts: [10, 200, 0.5, 200, 210, 0.5] }] } };
      localStorage.setItem('workshop:store', JSON.stringify(store));
    });
    await page.reload();
    await show(page, 'Notes');
    await expect(page.locator('.pad-surface:not(.print-page) .ink path')).toHaveCount(1);
  });

  test('while typing, the toolbar steps aside and the page has room to scroll above the keyboard', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    const before = await page.locator('.notes-pane').evaluate((el) => getComputedStyle(el).paddingBottom);
    await expect(page.getByRole('toolbar', { name: 'Study' })).toBeVisible();
    await draw(page, '.pad-surface', 'touch', [80, 200], [81, 201]);
    await expect(notes(page)).toBeFocused();
    await expect(page.getByRole('toolbar', { name: 'Study' })).toBeHidden();
    const typing = await page.locator('.notes-pane').evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
    expect(typing).toBeGreaterThan(parseFloat(before));
    expect(typing).toBeGreaterThanOrEqual(page.viewportSize()!.height * 0.5);
  });

  test('leaving the notes by their tab brings the toolbar back', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'touch', [80, 200], [81, 201]);
    await expect(notes(page)).toBeFocused();
    await page.getByRole('tab', { name: 'Bible', exact: true }).click();
    await expect(page.getByRole('toolbar', { name: 'Study' })).toBeVisible();
    await expect(page.locator('.scripture')).toBeInViewport();
  });
});
