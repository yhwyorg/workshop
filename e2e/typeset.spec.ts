import { beginStudy, draw, expect, savedStudies, test } from './fixtures';

/**
 * The Bible set as a printed Bible sets it: paragraphs, poetry in lines under a psalm's
 * title, the words of Jesus in red for those who want them. Before, every chapter ran
 * as one paragraph and the Psalms read as prose.
 */
test.describe('setting the text', () => {
  test('a chapter is set in its paragraphs', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await expect(page.locator('.scripture .blk-p')).toHaveCount(5);
    // Every verse is still there, once.
    await expect(page.locator('.scripture .v')).toHaveCount(27);
  });

  test('a psalm is set in lines, under its title', async ({ page }) => {
    await beginStudy(page, 'Psalms', 23);
    // The title's block also holds the psalm's numeral ("23"), set above it.
    await expect(page.locator('.scripture .blk-d')).toHaveText(/^23\s*A Psalm by David\.\s*$/);
    await expect(page.locator('.scripture .blk-q1').first()).toHaveText('The LORD is my shepherd;');
    await expect(page.locator('.scripture .blk-q2').first()).toHaveText('I shall lack nothing.');
    // The numeral stands on its own line: floated, it covered "The" (the hanging
    // indent pulled the line under it).
    const clear = await page.evaluate(() => {
      const d = document.querySelector('.drop')!.getBoundingClientRect();
      const w = document.querySelector('.blk-q1 .word')!.getBoundingClientRect();
      return d.bottom <= w.top || d.right <= w.left;
    });
    expect(clear).toBe(true);
  });

  for (const [book, chapter] of [['Psalms', 23], ['John', 1]] as const) {
    test(`words in ${book} ${chapter} sit side by side: none over another, none spread apart`, async ({ page }) => {
      // Word buttons inherited each paragraph's first-line indent inside themselves:
      // in the poetry's hanging indent they were crushed onto one another, in prose
      // they were pushed apart (seen on the dev server; no earlier test looked).
      await beginStudy(page, book, chapter);
      const gaps = await page.evaluate(() => {
        const out: number[] = [];
        for (const blk of document.querySelectorAll('.typeset .blk')) {
          const ws = [...blk.querySelectorAll('.word')].map((w) => w.getBoundingClientRect());
          for (let i = 1; i < ws.length; i++) if (Math.abs(ws[i].top - ws[i - 1].top) < 2) out.push(ws[i].left - ws[i - 1].right);
        }
        return out;
      });
      expect(gaps.length).toBeGreaterThan(20);
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(0);
      // A space at this size is a few pixels; a verse number between two words adds a little.
      expect(Math.max(...gaps)).toBeLessThan(30);
    });
  }

  test('a mark made in a paragraph stays on its word after a reload', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    const vine = page.locator('.word').filter({ hasText: /^vine,$/ }).first();
    await vine.click();
    await page.reload();
    await expect(page.locator('.word').filter({ hasText: /^vine,$/ }).first()).toHaveAttribute('aria-label', 'vine,, underlined');
  });

  test('ink written on a chapter before it was set this way keeps the setting it was written on', async ({ page }) => {
    // Paragraph breaks move every word after them; old ink would float over the wrong
    // words. So a chapter carrying ink from before keeps the old, continuous setting.
    await beginStudy(page, 'John', 15);
    await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem('workshop:store')!);
      store.pads[0].ink = { 'bible:15': { width: 560, strokes: [{ tool: 'pen', pts: [10, 10, 0.5, 60, 12, 0.5] }] } };
      localStorage.setItem('workshop:store', JSON.stringify(store));
    });
    await page.reload();
    await expect(page.locator('.scripture')).toBeVisible();
    await expect(page.locator('.scripture .blk-p')).toHaveCount(0);
    await expect(page.getByText('Set as it was when you wrote on it')).toBeVisible();
    // John 16 has no ink, and is set in paragraphs.
    await page.getByRole('button', { name: 'Next chapter' }).click();
    await expect(page.locator('.scripture .blk-p').first()).toBeVisible();
  });

  test('ink written on a chapter set in paragraphs says so, and keeps it', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await draw(page, '.bible-text', 'pen', [40, 80], [200, 90]);
    await expect.poll(async () => (await savedStudies(page))[0]?.ink?.['bible:15']?.layout).toBe(2);
    await page.reload();
    await expect(page.locator('.scripture .blk-p')).toHaveCount(5);
  });
});

test.describe('the words of Jesus', () => {
  test('are in red when chosen, and only his', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    const said = page.locator('.word').filter({ hasText: /^vine,$/ }).first();
    const color = () => said.evaluate((el) => getComputedStyle(el).color);
    const plain = await color();
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'Words of Jesus in red' }).click();
    await expect(page.getByRole('button', { name: 'Words of Jesus in red' })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect.poll(color).not.toBe(plain);
    // Kept for next time.
    await page.reload();
    await expect.poll(color).not.toBe(plain);
  });
});
