import type { Page } from '@playwright/test';
import { beginStudy, draw, expect, stopTyping, test, typeNotes } from './fixtures';

/**
 * The notepad can be made bigger, smaller, or folded away; it is a page that zooms, so
 * what is written on it stays where it was written. On a phone the notes are a tab, and
 * none of this applies.
 */
const notPhone = (name: string) => test.skip(name === 'phone', 'a phone shows the notes as a tab');
const box = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!;
const portrait = (name: string) => name === 'ipad-portrait';

/** Drags the notepad's edge by dx (wider when negative) or, upright, dy (taller when negative). */
async function dragEdge(page: Page, by: number, upright: boolean) {
  const edge = await box(page, '[role="separator"][aria-label="Notepad size"]');
  const x = edge.x + edge.width / 2;
  const y = edge.y + edge.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(upright ? x : x + (by * i) / 10, upright ? y + (by * i) / 10 : y);
  await page.mouse.up();
}

test.describe('the notepad’s size', () => {
  test('dragging its edge makes it bigger, the page and its writing with it, and it stays so', async ({ page }, info) => {
    notPhone(info.project.name);
    const upright = portrait(info.project.name);
    await beginStudy(page, 'John', 15);
    const before = await box(page, '.notes-pane');
    const pad = await box(page, '.pad-surface');
    await dragEdge(page, -160, upright);
    const after = await box(page, '.notes-pane');
    if (upright) expect(after.height).toBeGreaterThan(before.height + 100);
    else expect(after.width).toBeGreaterThan(before.width + 100);
    // Beside the Bible, a bigger page, not more lines of the same size: the pad is
    // zoomed. Below it (upright) the pad already spans the width, and a taller notepad
    // shows more of the page instead.
    if (!upright) expect((await box(page, '.pad-surface')).width).toBeGreaterThan(pad.width * 1.1);
    await page.reload();
    await expect.poll(async () => (upright ? (await box(page, '.notes-pane')).height : (await box(page, '.notes-pane')).width)).toBeGreaterThan((upright ? before.height : before.width) + 100);
  });

  test('its edge can be moved from the keyboard too', async ({ page }, info) => {
    notPhone(info.project.name);
    const upright = portrait(info.project.name);
    await beginStudy(page, 'John', 15);
    const before = await box(page, '.notes-pane');
    await page.getByRole('separator', { name: 'Notepad size' }).focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press(upright ? 'ArrowUp' : 'ArrowLeft');
    const after = await box(page, '.notes-pane');
    expect(upright ? after.height : after.width).toBeGreaterThan((upright ? before.height : before.width) + 50);
  });

  test('what was written stays on its words when the notepad is resized', async ({ page }, info) => {
    notPhone(info.project.name);
    await beginStudy(page, 'John', 15);
    await typeNotes(page, 'Abide in the vine.');
    await stopTyping(page);
    // Underline the typed line, then resize: the line and its underline move together.
    const line = await box(page, 'textarea.pad-lines');
    const surface = await box(page, '.pad-surface');
    const y = line.y - surface.y + 20;
    await draw(page, '.pad-surface', 'pen', [line.x - surface.x + 2, y], [line.x - surface.x + 120, y]);
    const gap = async () => {
      const ink = await box(page, '.pad-surface svg.ink path');
      const text = await box(page, 'textarea.pad-lines');
      return { dx: ink.x - text.x, dyRatio: (ink.y - text.y) / text.width };
    };
    const before = await gap();
    await dragEdge(page, -160, portrait(info.project.name));
    const after = await gap();
    const scale = (await box(page, '.pad-surface')).width / surface.width;
    expect(Math.abs(after.dx - before.dx * scale)).toBeLessThan(3);
    expect(Math.abs(after.dyRatio - before.dyRatio)).toBeLessThan(0.01);
  });
});

test.describe('folding the notepad', () => {
  test('it folds to a strip, giving the Bible the room, and unfolds as it was', async ({ page }, info) => {
    notPhone(info.project.name);
    await beginStudy(page, 'John', 15);
    const bible = await box(page, '.bible-pane');
    await page.getByRole('button', { name: 'Fold the notepad' }).click();
    await expect(page.getByLabel('Notes', { exact: true })).toBeHidden();
    // Beside the Bible a strip; below it (upright) gone, unfolded from the toolbar.
    if (portrait(info.project.name)) await expect(page.locator('.notes-pane')).toBeHidden();
    else {
      const folded = await box(page, '.notes-pane');
      expect(folded.width).toBeLessThan(64);
    }
    const wider = await box(page, '.bible-pane');
    expect(wider.width * wider.height).toBeGreaterThan(bible.width * bible.height * 1.1);
    // Still folded after a reload; then back as it was.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Unfold the notepad' })).toBeVisible();
    await page.getByRole('button', { name: 'Unfold the notepad' }).click();
    await expect(page.getByLabel('Notes', { exact: true })).toBeVisible();
  });
});
