import type { Page } from '@playwright/test';
import { beginStudy, expect, test } from './fixtures';

/**
 * Things that move: the toolbar, by its grip, and Darrell's pen, picked up out of the
 * toolbar and laid anywhere on the page. Both stay where they were put. (The user: "Can
 * we make them movable?", then "both".)
 */
const box = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!;
const noPens = (name: string) => test.skip(name === 'phone', 'a phone has no pens in its toolbar');

async function dragFrom(page: Page, from: { x: number; y: number }, by: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(from.x + (by.x * i) / 12, from.y + (by.y * i) / 12);
  await page.mouse.up();
}
const centre = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

test.describe('the toolbar', () => {
  test('drags by its grip to anywhere, stays there, and a double-click brings it home', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    const home = await box(page, '.toolbar');
    const grip = await box(page, '.tb-grip');
    await dragFrom(page, centre(grip), { x: 0, y: -300 });
    const moved = await box(page, '.toolbar');
    expect(home.y - moved.y).toBeGreaterThan(250);
    await page.reload();
    await expect.poll(async () => Math.round((await box(page, '.toolbar')).y)).toBe(Math.round(moved.y));
    await page.getByRole('button', { name: 'Move the toolbar' }).dblclick();
    await expect.poll(async () => Math.round((await box(page, '.toolbar')).y)).toBe(Math.round(home.y));
  });

  test('moves with the arrow keys too', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    const home = await box(page, '.toolbar');
    await page.getByRole('button', { name: 'Move the toolbar' }).focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowUp');
    expect(home.y - (await box(page, '.toolbar')).y).toBeGreaterThan(80);
  });

  test('never leaves the screen, however far it is dragged', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await dragFrom(page, centre(await box(page, '.tb-grip')), { x: -4000, y: -4000 });
    const b = await box(page, '.toolbar');
    const v = page.viewportSize()!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(v.width);
  });
});

test.describe('the pen', () => {
  test('is picked up out of the toolbar and laid on the page, where it stays', async ({ page }, info) => {
    noPens(info.project.name);
    await beginStudy(page, 'John', 15);
    const pen = await box(page, '.toolbar .pen-photo');
    const notes = await box(page, '.notes-pane');
    const drop = centre(notes);
    const from = centre(pen);
    await dragFrom(page, from, { x: drop.x - from.x, y: drop.y - from.y });
    const loose = page.locator('.pen-loose');
    await expect(loose).toBeVisible();
    const at = await loose.boundingBox();
    // Held where it was grabbed: the drop point is on the pen.
    expect(drop.x).toBeGreaterThan(at!.x);
    expect(drop.x).toBeLessThan(at!.x + at!.width);
    // The toolbar keeps its colours, with an empty slot where the pen was.
    await expect(page.getByRole('button', { name: 'Put the pen back' })).toBeVisible();
    await page.getByRole('button', { name: 'Red pen', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Red pen', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.locator('.pen-loose')).toBeVisible();
    await page.getByRole('button', { name: 'Put the pen back' }).click();
    await expect(page.locator('.pen-loose')).toHaveCount(0);
    await expect(page.locator('.toolbar .pen-photo')).toBeVisible();
  });

  test('dropped back on the toolbar, it goes back in', async ({ page }, info) => {
    noPens(info.project.name);
    await beginStudy(page, 'John', 15);
    const from = centre(await box(page, '.toolbar .pen-photo'));
    await dragFrom(page, from, { x: 0, y: -300 });
    await expect(page.locator('.pen-loose')).toBeVisible();
    const loose = centre(await box(page, '.pen-loose'));
    const bar = centre(await box(page, '.toolbar'));
    await dragFrom(page, loose, { x: bar.x - loose.x, y: bar.y - loose.y });
    await expect(page.locator('.pen-loose')).toHaveCount(0);
    await expect(page.locator('.toolbar .pen-photo')).toBeVisible();
  });
});
