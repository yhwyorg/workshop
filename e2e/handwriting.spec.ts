import { beginStudy, draw, expect, savedStudies, show, test, twoFingerDrag, typeNotes } from './fixtures';

/**
 * The notes are for handwriting first. A Pencil, a finger or a mouse writes on them
 * with nothing to choose first; Type switches to the keyboard. (Before this, only the
 * Pencil wrote, the mouse needed a pen chosen, and a finger could only type.)
 */
const padStrokes = async (page: import('@playwright/test').Page) => (await savedStudies(page))[0]?.ink?.pad?.strokes?.length ?? 0;

test.describe('writing on the notes', () => {
  test('a finger writes on them', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'touch', [60, 160], [260, 170]);
    await expect.poll(() => padStrokes(page)).toBe(1);
    await expect(page.locator('.pad-surface svg.ink path')).toHaveCount(1);
  });

  test('a mouse writes on them, with no pen to choose first', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'mouse', [60, 160], [260, 170]);
    await expect.poll(() => padStrokes(page)).toBe(1);
  });

  test('the Pencil writes on them', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'pen', [60, 160], [260, 170]);
    await expect.poll(() => padStrokes(page)).toBe(1);
  });

  test('a finger still does not write on the Bible: it taps words and scrolls', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await draw(page, '.bible-text', 'touch', [40, 40], [200, 40]);
    await page.waitForTimeout(400);
    expect((await savedStudies(page))[0]?.ink?.['bible:15']).toBeUndefined();
  });

  test('once a Pencil has written, a resting palm or finger no longer does', async ({ page }) => {
    // As Apple Notes does once a Pencil is paired: with a Pencil in hand, a hand on the
    // glass would otherwise leave marks.
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'pen', [60, 160], [260, 170]);
    await expect.poll(() => padStrokes(page)).toBe(1);
    await draw(page, '.pad-surface', 'touch', [60, 220], [260, 230]);
    await page.reload();
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'touch', [60, 260], [260, 270]);
    await page.waitForTimeout(400);
    expect(await padStrokes(page)).toBe(1);
  });

  test('two fingers scroll the notes and leave no mark', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await typeNotes(page, Array.from({ length: 80 }, (_, i) => `Line ${i + 1}`).join('\n'));
    await page.getByRole('button', { name: 'Write', exact: true }).click();
    const pane = page.getByRole('region', { name: 'Your notes' });
    expect(await pane.evaluate((el) => el.scrollTop)).toBe(0);
    await twoFingerDrag(page, '.pad-surface', [80, 300], -200);
    await expect.poll(() => pane.evaluate((el) => el.scrollTop)).toBeGreaterThan(150);
    await page.waitForTimeout(400);
    expect(await padStrokes(page)).toBe(0);
  });

  test('the page grows as it is written down, so there is always room below', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    const height = () => page.locator('.pad-surface').evaluate((el) => el.getBoundingClientRect().height);
    const before = await height();
    await draw(page, '.pad-surface', 'pen', [60, before - 20], [260, before - 10]);
    await expect.poll(height).toBeGreaterThan(before + 150);
  });
});

test.describe('typing on the notes', () => {
  test('while writing, the page cannot be typed on, so iPad cannot turn the Pencil into text', async ({ page }) => {
    // iPadOS Scribble converts Pencil writing over any editable field into typed text.
    // A read-only page gives it nothing to convert; Scribble itself can't run here.
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await expect(page.getByRole('button', { name: 'Write', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Notes', { exact: true })).toHaveAttribute('readonly', '');
    await expect(page.getByLabel('Title', { exact: true })).toHaveAttribute('readonly', '');
  });

  test('Type switches to the keyboard, Write switches back, and both kinds of writing stay', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'pen', [60, 160], [260, 170]);
    await typeNotes(page, 'Abide.');
    await page.getByRole('button', { name: 'Write', exact: true }).click();
    await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('Abide.');
    await expect(page.locator('.pad-surface svg.ink path')).toHaveCount(1);
    await expect.poll(async () => (await savedStudies(page))[0]?.notes?.page).toBe('Abide.');
  });

  test('a reader who types is still typing after a reload', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await typeNotes(page, 'Abide.');
    await page.reload();
    await show(page, 'Notes');
    await expect(page.getByRole('button', { name: 'Type', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Notes', { exact: true })).not.toHaveAttribute('readonly');
  });
});
