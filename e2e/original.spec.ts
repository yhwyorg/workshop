import type { Page } from '@playwright/test';
import { beginStudy, expect, recordedApi, test } from './fixtures';

/**
 * A verse in its original language: the Greek or Hebrew words in order, each with a
 * gloss, and opened, its dictionary entry and grammar. Served from this site (SBLGNT,
 * WLC via MACULA; Strong's via Open Scriptures).
 */
const openVerse = async (page: Page, verse: number) => page.getByRole('button', { name: `Verse ${verse}`, exact: true }).click();
const panel = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true });

test.describe('the original language', () => {
  test('a New Testament verse shows its Greek, word by word, with what each word means', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await openVerse(page, 5);
    const greek = panel(page, 'John 15:5').getByRole('region', { name: 'In the Greek' });
    await expect(greek).toContainText('ἄμπελος');
    await greek.getByRole('button', { name: /^ἄμπελος/ }).click();
    const entry = greek.getByRole('group', { name: 'ἄμπελος' });
    await expect(entry).toContainText('G288');
    // Strong's transliterates with its accent.
    await expect(entry).toContainText('ámpelos');
    await expect(entry).toContainText('a vine');
    await expect(entry).toContainText('noun nominative singular feminine');
  });

  test('an Old Testament verse shows its Hebrew, right to left, with the Greek of the Septuagint', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'Psalms', 23);
    await openVerse(page, 1);
    const hebrew = panel(page, 'Psalms 23:1').getByRole('region', { name: 'In the Hebrew' });
    await expect(hebrew.locator('[dir="rtl"]')).toBeVisible();
    // Found by its gloss: pointed Hebrew can be encoded more than one equal way.
    await hebrew.getByRole('button', { name: /LORD$/ }).click();
    const entry = hebrew.getByRole('group');
    await expect(entry).toContainText('H3068');
    // Matched by its number: Greek accents have two encodings that look the same (the
    // data's ύ is not the one typed here, and the text didn't match).
    await expect(entry).toContainText(/Septuagint: κ\S+ \(G2962\)/);
  });

  test('a verse the Greek text lacks says so, and why', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 5);
    await openVerse(page, 4);
    await expect(panel(page, 'John 5:4').getByRole('region', { name: 'In the Greek' })).toContainText('found in later manuscripts');
  });

  test('a verse the Greek numbers with the one before says that, not that it is missing', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, '2 Corinthians', 13);
    await openVerse(page, 14);
    const greek = panel(page, '2 Corinthians 13:14').getByRole('region', { name: 'In the Greek' });
    await expect(greek).toContainText('as part of the verse before');
    await expect(greek).not.toContainText('later manuscripts');
  });

  test('a chapter the Hebrew numbers differently says so, rather than showing the wrong verse', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'Psalms', 51);
    await openVerse(page, 1);
    await expect(panel(page, 'Psalms 51:1').getByRole('region', { name: 'In the Hebrew' })).toContainText('numbers this chapter differently');
  });
});
