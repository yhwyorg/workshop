import { expect, test as base, type Page } from '@playwright/test';

/**
 * Every test fails if the page logs an error or an uncaught exception. A page can
 * render and pass every visible check while its console reports a failed fetch or a
 * crashed effect; this makes that loud.
 */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(e.message));
      await use(errors);
      expect(errors, 'console errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** Begins a study the way a reader does: the Bible's contents, a book, a chapter. */
export async function beginStudy(page: Page, book: string, chapter: number) {
  await page.goto('/#/new');
  await page.getByRole('button', { name: book, exact: true }).click();
  await page.getByRole('button', { name: String(chapter), exact: true }).click();
  await expect(page).toHaveURL(/#\/study\//);
  await expect(page.locator('.scripture')).toBeVisible();
}

/**
 * Draws with a stylus. Synthetic pointer events with pointerType "pen" and real
 * pressure: the same path an Apple Pencil takes through the app.
 */
export async function draw(page: Page, selector: string, kind: 'pen' | 'touch', from: [number, number], to: [number, number]) {
  await page.locator(selector).evaluate(
    (el, { kind, from, to }) => {
      const r = el.getBoundingClientRect();
      const fire = (type: string, x: number, y: number, pressure: number) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true, cancelable: true, pointerId: 11, pointerType: kind, clientX: r.left + x, clientY: r.top + y,
            pressure, buttons: 1, button: 0,
          }),
        );
      fire('pointerdown', from[0], from[1], 0.4);
      for (let i = 1; i <= 12; i++) {
        fire('pointermove', from[0] + ((to[0] - from[0]) * i) / 12, from[1] + ((to[1] - from[1]) * i) / 12, 0.3 + 0.4 * Math.sin(i / 4));
      }
      fire('pointerup', to[0], to[1], 0);
    },
    { kind, from, to },
  );
}

/**
 * Shows a pane: the Bible, the notes, or a reference by its short name ("KJV"). Where
 * panes share a place they are a tap apart (tabs); where everything is on screen there
 * is no tab, and nothing to tap.
 */
export async function show(page: Page, pane: string) {
  const tab = page.getByRole('tab', { name: pane, exact: true });
  if (await tab.isVisible()) await tab.click();
}

/** The saved studies, read straight from storage: proves a change was kept, not just drawn. */
export async function savedStudies(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('workshop:store') ?? '{"pads":[]}').pads);
}
