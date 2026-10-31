import { beginStudy, compareWith, expect, forgiveFailedLoads, recordedApi, show, test, typeNotes } from './fixtures';

/**
 * The reference pane: another translation or a commentary beside the Bible. The API
 * is replaced by recorded responses (see recordedApi in fixtures.ts).
 */
test.describe('the reference pane', () => {
  test('Compare puts another translation beside the Bible, at the same chapter', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'King James Version');
    await show(page, 'KJV');
    const ref = page.getByRole('region', { name: 'King James Version', exact: true });
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
    await expect(page.getByRole('region', { name: 'Berean Standard Bible', exact: true })).toContainText('I have told you these things so that you will not fall away.');
  });

  test('Compare is found in a chapter that says "compared" (Romans 8:18)', async ({ page, errors }) => {
    await recordedApi(page);
    await beginStudy(page, 'Romans', 8);
    await compareWith(page, 'King James Version');
    // No recording of Romans 8, so the API stand-in answers 404: the button is what's tested.
    await expect(page.getByRole('region', { name: 'King James Version', exact: true })).toContainText('Nothing from King James Version on Romans 8');
    forgiveFailedLoads(errors);
  });

  test('a commentary shows its notes under the verses they begin at', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'Matthew Henry');
    await show(page, 'Henry');
    const ref = page.getByRole('region', { name: 'Matthew Henry', exact: true });
    await expect(ref).toContainText('Here Christ discourses concerning the fruit');
    await expect(ref.getByRole('heading', { name: 'Verse 9' })).toBeVisible();
  });

  test('a commentary with nothing on the chapter says so, not that it failed', async ({ page, errors }) => {
    await recordedApi(page);
    await beginStudy(page, 'Ruth', 1);
    await compareWith(page, 'John Calvin');
    await show(page, 'Calvin');
    const ref = page.getByRole('region', { name: 'John Calvin', exact: true });
    await expect(ref).toContainText('Nothing from John Calvin on Ruth 1');
    await expect(ref.getByRole('alert')).toHaveCount(0);
    forgiveFailedLoads(errors);
  });

  test('when the source cannot be reached it says so, and the study carries on', async ({ page, errors }) => {
    await recordedApi(page, { down: true });
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'King James Version');
    await show(page, 'KJV');
    await expect(page.getByRole('region', { name: 'King James Version', exact: true }).getByRole('alert')).toContainText('couldn’t be reached');
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
    await expect(page.getByRole('region', { name: 'King James Version', exact: true })).toContainText('husbandman');
  });

  test('the notes are a tap away while a reference is open, and closing it brings them back', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await compareWith(page, 'King James Version');
    await show(page, 'Notes');
    await expect(page.getByLabel('Notes', { exact: true })).toBeVisible();
    await show(page, 'KJV');
    await page.getByRole('button', { name: 'Close King James Version' }).click();
    await expect(page.getByRole('region', { name: 'King James Version', exact: true })).toHaveCount(0);
    await show(page, 'Notes');
    await expect(page.getByLabel('Notes', { exact: true })).toBeVisible();
  });
});
