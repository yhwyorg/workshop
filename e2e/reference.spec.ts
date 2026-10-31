import { readFileSync, existsSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { beginStudy, expect, show, test, typeNotes } from './fixtures';

/**
 * The reference pane: another translation or a commentary beside the Bible.
 *
 * The API is replaced by responses recorded from it (e2e/recorded/, fetched from
 * bible.helloao.org on 2026-10-31), so these tests are about the page, not about a
 * website's uptime. A chapter with no recording answers 404, as the API does for a
 * book a commentary does not cover.
 */
async function recordedApi(page: Page, opts: { down?: boolean } = {}) {
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
function forgiveFailedLoads(errors: string[]) {
  const rest = errors.filter((e) => !/^Failed to load resource/.test(e));
  errors.splice(0, errors.length, ...rest);
}

async function compareWith(page: Page, name: string) {
  // Exact: every word of Scripture is a button too, and Romans 8:18 has "compared".
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
}

test.describe('the reference pane', () => {
  test('Compare puts another translation beside the Bible, at the same chapter', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'King James Version');
    await show(page, 'KJV');
    const ref = page.getByRole('region', { name: 'King James Version' });
    await expect(ref).toContainText('I am the true vine, and my Father is the husbandman.');
    // The Bible itself is still on screen beside it, except on a phone (a tab away).
    if (!(await page.getByRole('tab', { name: 'Bible' }).isVisible())) {
      await expect(page.locator('.scripture')).toBeInViewport();
    }
  });

  test('turning the chapter turns the reference too', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'Berean Standard Bible');
    await page.getByRole('button', { name: 'Next chapter' }).click();
    await show(page, 'BSB');
    await expect(page.getByRole('region', { name: 'Berean Standard Bible' })).toContainText('I have told you these things so that you will not fall away.');
  });

  test('Compare is found in a chapter that says "compared" (Romans 8:18)', async ({ page, errors }) => {
    await recordedApi(page);
    await beginStudy(page, 'Romans', 8);
    await compareWith(page, 'King James Version');
    // No recording of Romans 8, so the API stand-in answers 404: the button is what's tested.
    await expect(page.getByRole('region', { name: 'King James Version' })).toContainText('Nothing from King James Version on Romans 8');
    forgiveFailedLoads(errors);
  });

  test('a commentary shows its notes under the verses they begin at', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'Matthew Henry');
    await show(page, 'Henry');
    const ref = page.getByRole('region', { name: 'Matthew Henry' });
    await expect(ref).toContainText('Here Christ discourses concerning the fruit');
    await expect(ref.getByRole('heading', { name: 'Verse 9' })).toBeVisible();
  });

  test('a commentary with nothing on the chapter says so, not that it failed', async ({ page, errors }) => {
    await recordedApi(page);
    await beginStudy(page, 'Ruth', 1);
    await compareWith(page, 'John Calvin');
    await show(page, 'Calvin');
    const ref = page.getByRole('region', { name: 'John Calvin' });
    await expect(ref).toContainText('Nothing from John Calvin on Ruth 1');
    await expect(ref.getByRole('alert')).toHaveCount(0);
    forgiveFailedLoads(errors);
  });

  test('when the source cannot be reached it says so, and the study carries on', async ({ page, errors }) => {
    await recordedApi(page, { down: true });
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'King James Version');
    await show(page, 'KJV');
    await expect(page.getByRole('region', { name: 'King James Version' }).getByRole('alert')).toContainText('couldn’t be reached');
    await typeNotes(page, 'Still writing.');
    await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('Still writing.');
    forgiveFailedLoads(errors);
  });

  test('the reference chosen is still there after a reload', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'King James Version');
    await page.reload();
    await show(page, 'KJV');
    await expect(page.getByRole('region', { name: 'King James Version' })).toContainText('husbandman');
  });

  test('the notes are a tap away while a reference is open, and closing it brings them back', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'King James Version');
    await show(page, 'Notes');
    await expect(page.getByLabel('Notes', { exact: true })).toBeVisible();
    await show(page, 'KJV');
    await page.getByRole('button', { name: 'Close King James Version' }).click();
    await expect(page.getByRole('region', { name: 'King James Version' })).toHaveCount(0);
    await show(page, 'Notes');
    await expect(page.getByLabel('Notes', { exact: true })).toBeVisible();
  });
});
