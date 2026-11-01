import { beginStudy, expect, savedStudies, test } from './fixtures';

/**
 * Advent: the readings of Darrell's book, week by week, each a tap from the Bible. The
 * user asked for this built on "Awaken Wonder", with his work protected: references, links
 * and a short snippet a week, to send people to the book. It isn't made to be printed.
 */
const READINGS = [
  'Luke 1:26-56',
  'Luke 1:1-25', 'Luke 1:57-80', 'Matthew 1:1-17',
  'Matthew 1:18-25', 'Luke 2:1-21',
  'Luke 2:22-40', 'Matthew 2:1-23', 'Luke 2:41-52',
];
const firstVerse = (reading: string) => reading.split(':')[1].split('-')[0];

test.describe('Advent', () => {
  test('is in the menu, and names the book and its author', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 10, 1, 12));
    await page.goto('/#/studies');
    await page.getByRole('button', { name: 'Menu', exact: true }).first().click();
    await page.getByRole('link', { name: 'Advent readings' }).click();
    await expect(page.getByRole('heading', { name: 'Advent', exact: true })).toBeVisible();
    await expect(page.getByText('Awaken Wonder: Daily Devotions for Advent')).toBeVisible();
    await expect(page.getByText('Darrell W. Johnson', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Advent begins on Sunday, November 29.')).toBeVisible();
    await expect(page.getByText('This week', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Get the book/ }).first()).toHaveAttribute('href', /amazon\.ca/);
  });

  test('marks the week it is, and only then', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 11, 8, 12));
    await page.goto('/#/advent');
    const week = page.getByRole('region', { name: 'Week Two' });
    await expect(week).toContainText('This week');
    await expect(week).toContainText('December 6');
    await expect(page.getByText('This week', { exact: true })).toHaveCount(1);
  });

  test('on Christmas Day no week is this week, and it says what comes next', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 11, 25, 12));
    await page.goto('/#/advent');
    await expect(page.getByText('This week', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Week One' })).toContainText('November 28');
  });

  test('each week links to his own reflection, opening apart from the study', async ({ page }) => {
    await page.goto('/#/advent');
    for (const name of ['Week One', 'Week Two', 'Week Three', 'Week Four']) {
      const link = page.getByRole('region', { name }).getByRole('link', { name: /reflection/ });
      await expect(link).toHaveAttribute('href', /^https:\/\/www\.darrelljohnson\.ca\/articles\//);
      await expect(link).toHaveAttribute('target', '_blank');
    }
  });

  test('each week quotes a few words of the book, says where from, and points to the book', async ({ page }) => {
    await page.goto('/#/advent');
    for (const [name, words] of [['Week One', 'Mary dared to believe'], ['Week Two', 'The God of Christmas'], ['Week Three', 'his actions speak volumes'], ['Week Four', 'miss the point of it']]) {
      const week = page.getByRole('region', { name });
      await expect(week.locator('blockquote')).toContainText(words);
      await expect(week.locator('blockquote')).toContainText('From Awaken Wonder');
      await expect(week.getByRole('link', { name: 'Get the book' })).toHaveAttribute('href', /amazon\.ca/);
    }
  });

  test('isn’t made to be printed: no button for it, and on paper the snippets are left out', async ({ page }) => {
    // The user: "Don't make it, like, printable". A page can't stop a screenshot, but it
    // needn't offer the book's words as a handout.
    await page.goto('/#/advent');
    await expect(page.getByRole('button', { name: /print/i })).toHaveCount(0);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.advent-snippet').first()).toBeHidden();
    await expect(page.getByRole('button', { name: 'Luke 1:26-56', exact: true })).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
    await expect(page.locator('.advent-snippet').first()).toBeVisible();
  });

  for (const reading of READINGS) {
    test(`${reading} opens at its first verse, set off from the verses around it`, async ({ page }) => {
      await page.goto('/#/advent');
      await page.getByRole('button', { name: reading, exact: true }).click();
      await expect(page).toHaveURL(/#\/study\//);
      await expect(page.locator(`.bible-text [data-verse="${firstVerse(reading)}"]`)).toBeInViewport();
      await expect(page.locator('.in-study').first()).toBeVisible();
      // Polled: a study is saved 300ms after it begins, and the verse can be on screen sooner.
      await expect.poll(async () => (await savedStudies(page)).map((x: { passage: string }) => x.passage)).toEqual([reading]);
    });
  }

  test('a reading opened twice is the same study, not a second one', async ({ page }) => {
    await page.goto('/#/advent');
    await page.getByRole('button', { name: 'Luke 2:1-21', exact: true }).click();
    await expect(page).toHaveURL(/#\/study\//);
    const first = page.url();
    await expect.poll(async () => (await savedStudies(page)).length).toBe(1);
    await page.goto('/#/advent');
    await page.reload();
    await page.getByRole('button', { name: 'Luke 2:1-21', exact: true }).click();
    await expect(page).toHaveURL(first);
    expect(await savedStudies(page)).toHaveLength(1);
  });

  test('a study of a whole chapter still opens at its top', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    expect(await page.locator('.bible-pane').evaluate((el) => el.scrollTop)).toBe(0);
  });
});
