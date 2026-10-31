import { existsSync, readFileSync } from 'node:fs';
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
 * Draws with a stylus, a finger or a mouse. Synthetic pointer events with real
 * pressure: the same path an Apple Pencil takes through the app.
 */
export async function draw(page: Page, selector: string, kind: 'pen' | 'touch' | 'mouse', from: [number, number], to: [number, number]) {
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

/**
 * Two fingers dragged up the surface together, as a reader scrolls on an iPad. Two
 * pointers, both "touch", moving in step.
 */
export async function twoFingerDrag(page: Page, selector: string, at: [number, number], dy: number) {
  await page.locator(selector).evaluate(
    (el, { at, dy }) => {
      const r = el.getBoundingClientRect();
      const fire = (type: string, id: number, x: number, y: number) =>
        el.dispatchEvent(
          new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: id === 21, clientX: r.left + x, clientY: r.top + y, buttons: 1 }),
        );
      fire('pointerdown', 21, at[0], at[1]);
      fire('pointerdown', 22, at[0] + 60, at[1]);
      for (let i = 1; i <= 10; i++) {
        fire('pointermove', 21, at[0], at[1] + (dy * i) / 10);
        fire('pointermove', 22, at[0] + 60, at[1] + (dy * i) / 10);
      }
      fire('pointerup', 21, at[0], at[1] + dy);
      fire('pointerup', 22, at[0] + 60, at[1] + dy);
    },
    { at, dy },
  );
}

/**
 * Types into the notes. The notes start out for handwriting, where the page can't be
 * typed on (or the Pencil would be turned into text); Type switches to the keyboard.
 */
export async function typeNotes(page: Page, text: string, label = 'Notes') {
  await show(page, 'Notes');
  const type = page.getByRole('button', { name: 'Type', exact: true });
  if ((await type.getAttribute('aria-pressed')) !== 'true') await type.click();
  await page.getByLabel(label, { exact: true }).fill(text);
}

/** The saved studies, read straight from storage: proves a change was kept, not just drawn. */
export async function savedStudies(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('workshop:store') ?? '{"pads":[]}').pads);
}

/**
 * The Bible API behind the references, replaced by responses recorded from it
 * (e2e/recorded/, fetched from bible.helloao.org on 2026-10-31), so these tests are
 * about the page, not about a website's uptime. A chapter with no recording answers
 * 404, as the API does for a book a commentary does not cover.
 */
export async function recordedApi(page: Page, opts: { down?: boolean } = {}) {
  await page.route('https://bible.helloao.org/api/**', async (route) => {
    if (opts.down) return route.abort('internetdisconnected');
    const path = new URL(route.request().url()).pathname.replace('/api/', '').replace(/\.json$/, '');
    const file = new URL(`./recorded/${path.replaceAll('/', '_')}.json`, import.meta.url);
    if (!existsSync(file)) return route.fulfill({ status: 404, contentType: 'text/html', body: '<html>Not found</html>' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: readFileSync(file, 'utf8') });
  });
}

/**
 * The browser logs every 404 and every failed request to the console itself; the page
 * cannot stop it. Only those lines are forgiven, so any other error still fails.
 */
export function forgiveFailedLoads(errors: string[]) {
  const rest = errors.filter((e) => !/^Failed to load resource/.test(e));
  errors.splice(0, errors.length, ...rest);
}

export async function compareWith(page: Page, name: string) {
  // Exact: every word of Scripture is a button too, and Romans 8:18 has "compared".
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
}
