import { beginStudy, draw, expect, savedStudies, test } from './fixtures';

test.describe('beginning', () => {
  test('a first visit opens the Bible to choose where to begin', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/#\/new$/);
    await expect(page.getByRole('heading', { name: 'The Holy Bible' })).toBeVisible();
  });

  test('a study begins at a book and a chapter, the whole chapter on the page', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await expect(page).toHaveTitle(/John 15/);
    await expect(page.locator('.scripture .v')).toHaveCount(27);
  });

  test('a passage can be typed instead', async ({ page }) => {
    await page.goto('/#/new');
    await page.getByLabel('Or type a passage').fill('Ps 23');
    await page.getByRole('button', { name: 'Open' }).click();
    await expect(page).toHaveTitle(/Psalms 23/);
  });

  test('a mistyped passage says why, rather than opening nothing', async ({ page }) => {
    await page.goto('/#/new');
    await page.getByLabel('Or type a passage').fill('Hezekiah 1');
    await page.getByRole('button', { name: 'Open' }).click();
    await expect(page.getByRole('alert')).toContainText('isn’t a book');
  });

  test('the site reopens where work was left', async ({ page }) => {
    await beginStudy(page, 'Mark', 4);
    const url = page.url();
    await page.goto('/');
    await expect(page).toHaveURL(url);
  });
});

test.describe('working on a passage', () => {
  test('marks, the title and notes survive a reload', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    // Found by its text, which stays "vine," when marked. Its accessible name becomes
    // "vine,, underlined", so a role-and-name locator re-resolved after the first click
    // and the second click marked the next "vine," in verse 4 instead.
    const vine = page.locator('.word').filter({ hasText: /^vine,$/ }).first();
    await vine.click();
    await vine.click();
    await page.getByLabel('Title').fill('Remain in me');
    await page.getByLabel('Notes').fill('Remain: eleven times.');
    await expect.poll(async () => (await savedStudies(page))[0]?.notes?.page).toBe('Remain: eleven times.');

    await page.reload();
    await expect(vine).toHaveAttribute('aria-label', 'vine,, circled');
    await expect(page.getByLabel('Title')).toHaveValue('Remain in me');
    await expect(page.getByLabel('Notes')).toHaveValue('Remain: eleven times.');
  });

  test('an Apple Pencil writes; a finger does not', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await draw(page, '.bible-text', 'touch', [40, 40], [200, 40]);
    await draw(page, '.bible-text', 'pen', [40, 80], [200, 90]);
    await expect.poll(async () => (await savedStudies(page))[0]?.ink?.['bible:15']?.strokes?.length).toBe(1);
    await expect(page.locator('.bible-text svg.ink path')).toHaveCount(1);
  });

  test('a Pencil tap on a word writes, it does not also mark the word', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    const box = (await page.getByRole('button', { name: 'farmer.', exact: true }).boundingBox())!;
    const page_ = (await page.locator('.bible-text').boundingBox())!;
    const at: [number, number] = [box.x - page_.x + 5, box.y - page_.y + 5];
    await draw(page, '.bible-text', 'pen', at, [at[0] + 2, at[1] + 1]);
    await page.getByRole('button', { name: 'farmer.', exact: true }).dispatchEvent('click');
    await expect.poll(async () => (await savedStudies(page))[0]?.ink?.['bible:15']?.strokes?.length).toBe(1);
    expect((await savedStudies(page))[0].marks).toEqual({});
  });
});

test.describe('pen and finger together', () => {
  test('a finger tap after a long pen stroke still marks the word', async ({ page }) => {
    // A long stroke ends without a click; the pen's "swallow my click" must not wait
    // around and eat the next finger tap instead.
    await beginStudy(page, 'John', 15);
    await draw(page, '.bible-text', 'pen', [30, 120], [300, 130]);
    const farmer = page.locator('.word').filter({ hasText: /^farmer\.$/ }).first();
    await farmer.click();
    await expect(farmer).toHaveAttribute('aria-label', 'farmer., underlined');
  });
});

test.describe('on an iPad', () => {
  test('turning it keeps the writing column the same width, so ink stays on its words', async ({ page }, info) => {
    test.skip(!info.project.name.startsWith('ipad'), 'iPad only');
    await beginStudy(page, 'John', 15);
    const width = () => page.locator('.bible-text').evaluate((el) => Math.round(el.getBoundingClientRect().width));
    const size = page.viewportSize()!;
    const before = await width();
    await page.setViewportSize({ width: size.height, height: size.width });
    expect(await width()).toBe(before);
  });
});

test.describe('on a phone', () => {
  test('nothing scrolls sideways', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'phone only');
    await beginStudy(page, 'John', 15);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

test.describe('the first version’s names', () => {
  test('an old link to a "pad" still opens its study', async ({ page }) => {
    await beginStudy(page, 'Ruth', 1);
    const id = page.url().split('/').pop()!;
    await page.goto(`/#/pad/${id}`);
    await expect(page).toHaveTitle(/Ruth 1/);
  });
});
