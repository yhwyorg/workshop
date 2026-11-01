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
  test('fits the screen where it starts, on every device', async ({ page }) => {
    // With the grip added it was 841px wide on an upright iPad's 834px (caught in CI).
    await beginStudy(page, 'John', 15);
    const b = await box(page, '.toolbar');
    const v = page.viewportSize()!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(v.width);
  });

  // The Greek button made it 835px on CI's 834 (821 on Windows: fonts differ). Measuring
  // then found long names already ran off an upright iPad: 1 Thessalonians was 851px.
  test('stays on one row for an ordinary chapter, keeping its buttons full size', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    expect((await box(page, '.toolbar')).height).toBeLessThan(70);
    expect((await box(page, '.tb-place')).height).toBeGreaterThanOrEqual(44);
  });

  for (const [book, chapter] of [['1 Thessalonians', 5], ['Deuteronomy', 34], ['Jeremiah', 52]] as const) {
    test(`stays on screen in ${book}`, async ({ page }) => {
      await beginStudy(page, book, chapter);
      const b = await box(page, '.toolbar');
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      // However the name is shortened to fit, it is still the whole name to a screen reader.
      await expect(page.getByRole('button', { name: `${book} ${chapter}`, exact: true })).toBeVisible();
    });
  }

  test('wraps rather than leaving the screen, on the smallest phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await beginStudy(page, '1 Thessalonians', 5);
    const b = await box(page, '.toolbar');
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(320);
    await expect(page.getByRole('button', { name: 'Greek', exact: true })).toBeInViewport({ ratio: 1 });
  });

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

  test('turns any which way: an end dragged round, or the arrow keys', async ({ page }, info) => {
    noPens(info.project.name);
    // Five things in a row (pick up, turn, move, key, reload): on WebKit under a loaded
    // machine it ran past 30s at the last step; replayed alone, every step was right.
    test.slow();
    await beginStudy(page, 'John', 15);
    const from = centre(await box(page, '.toolbar .pen-photo'));
    await dragFrom(page, from, { x: 0, y: -320 });
    const pen = page.locator('.pen-loose');
    await expect(pen).toBeVisible();
    const angle = () => pen.evaluate((el) => Number(/rotate\((-?[\d.]+)deg\)/.exec((el as HTMLElement).style.transform)?.[1]));
    const before = await angle();
    // Grab near the right end and swing it down: the pen turns about its middle.
    const b = await pen.boundingBox();
    const mid = centre(b!);
    const end = { x: mid.x + b!.width * 0.4, y: mid.y };
    await dragFrom(page, end, { x: -40, y: 90 });
    expect(Math.abs((await angle()) - before)).toBeGreaterThan(30);
    // And the middle still moves it, at the angle it now lies at.
    const turned = await angle();
    await dragFrom(page, centre((await pen.boundingBox())!), { x: -60, y: 40 });
    expect(await angle()).toBe(turned);
    await pen.focus();
    await page.keyboard.press('ArrowRight');
    expect(await angle()).toBe(turned + 15);
    await page.reload();
    await expect.poll(angle).toBe(turned + 15);
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
