import { beginStudy, draw, expect, savedBible, savedStudies, test } from './fixtures';

/**
 * One Bible, every study. The user asked to "markup the bible too and put notes in there
 * next to the verses… could those notes carry through the study sessions?", and chose
 * one Bible holding every mark, as a printed Bible keeps what was written in it.
 */

const vine = (page: import('@playwright/test').Page) => page.locator('.word').filter({ hasText: /^vine,$/ }).first();

test.describe('one Bible', () => {
  test('a word marked in one study is marked in the next study of that chapter', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await vine(page).click();
    await expect(vine(page)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await savedBible(page)).marks).toEqual({ '15001:4': 'underline' });
    await beginStudy(page, 'John', 15);
    await expect.poll(async () => (await savedStudies(page)).length).toBe(2);
    await expect(vine(page)).toHaveAttribute('aria-label', 'vine,, underlined');
  });

  test('ink on the Bible in one study is there in the next, and undo in either takes it off', async ({ page }, info) => {
    await beginStudy(page, 'John', 15);
    await draw(page, '.bible-text', 'pen', [40, 80], [200, 90]);
    await expect.poll(async () => (await savedBible(page)).ink['15']?.strokes.length).toBe(1);
    await beginStudy(page, 'John', 15);
    await expect(page.locator('.bible-text svg.ink path')).toHaveCount(1);
    // A phone's toolbar has no pens, and so no Undo.
    if (info.project.name === 'phone') return;
    // The second study wrote it too; its own undo takes back only what it wrote.
    await draw(page, '.bible-text', 'pen', [40, 140], [200, 150]);
    await expect(page.locator('.bible-text svg.ink path')).toHaveCount(2);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('.bible-text svg.ink path')).toHaveCount(1);
    await expect.poll(async () => (await savedBible(page)).ink['15']?.strokes.length).toBe(1);
  });

  test('marks stay on their own chapter and their own book', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await vine(page).click();
    await expect.poll(async () => Object.keys((await savedBible(page)).marks)).toHaveLength(1);
    // John 14 and Genesis 15 have none of John 15's marks.
    for (const [book, ch] of [['John', 14], ['Genesis', 15]] as const) {
      await beginStudy(page, book, ch);
      await expect(page.locator('.scripture .word[aria-pressed="true"]')).toHaveCount(0);
    }
  });

  test('deleting a study leaves the Bible’s marks, and says so first', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await vine(page).click();
    await expect.poll(async () => Object.keys((await savedBible(page)).marks)).toHaveLength(1);
    let asked = '';
    page.once('dialog', (d) => {
      asked = d.message();
      void d.accept();
    });
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('button', { name: 'Delete this study' }).click();
    expect(asked).toContain('stays in your Bible');
    await expect.poll(async () => (await savedStudies(page)).length).toBe(0);
    await beginStudy(page, 'John', 15);
    await expect(vine(page)).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('marks made before there was one Bible', () => {
  test('are moved into it as the studies are read, from every study, and nothing is lost', async ({ page }) => {
    // Two studies saved by the version before this one: each kept its own marks and ink.
    await page.goto('/#/studies');
    await page.evaluate(() => {
      const study = (id: string, updated: string, marks: Record<string, string>, ink: object) => ({
        id, title: '', passage: 'John 15', created: updated, updated, notes: {}, marks, ink,
      });
      const stroke = (y: number) => ({ width: 560, layout: 2, strokes: [{ tool: 'pen', pts: [40, y, 0.5, 200, y, 0.5] }] });
      localStorage.setItem('workshop:store', JSON.stringify({
        version: 1,
        pads: [
          study('a', '2026-10-30T10:00:00Z', { '15001:4': 'underline' }, { 'bible:15': stroke(80), pad: stroke(50) }),
          study('b', '2026-10-31T10:00:00Z', { '15005:3': 'box' }, { 'bible:15': stroke(140) }),
        ],
      }));
    });
    // Read afresh, as on opening the app: a new hash alone keeps the store already read.
    await page.goto('/#/study/a');
    await page.reload();
    await expect(page.locator('.scripture')).toBeVisible();
    await expect(page.locator('.scripture .word[aria-pressed="true"]')).toHaveCount(2);
    await expect(page.locator('.bible-text svg.ink path')).toHaveCount(2);
    // Saved so, even with nothing else changed; the notepad's ink stays with its study.
    await expect.poll(async () => (await savedBible(page)).marks).toEqual({ '15001:4': 'underline', '15005:3': 'box' });
    const [a, b] = await savedStudies(page);
    expect([a.marks, b.marks, a.ink?.['bible:15'], b.ink]).toEqual([{}, {}, undefined, undefined]);
    expect(a.ink?.pad?.strokes).toHaveLength(1);
  });
});

test.describe('a saved copy', () => {
  test('carries the Bible’s marks on its chapters, and brings them into the Bible it is opened in', async ({ page, browser }) => {
    await beginStudy(page, 'John', 15);
    await vine(page).click();
    await expect.poll(async () => Object.keys((await savedBible(page)).marks)).toHaveLength(1);
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const saving = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save a copy' }).click();
    const file = await (await saving).path();

    // Somewhere else: a browser that has never seen this study.
    const elsewhere = await (await browser.newContext()).newPage();
    await elsewhere.goto(page.url().replace(/#.*/, '#/studies'));
    await elsewhere.getByRole('button', { name: 'Menu', exact: true }).click();
    await elsewhere.locator('input[type=file]').setInputFiles(file);
    await expect(elsewhere.locator('.scripture')).toBeVisible();
    await expect(vine(elsewhere)).toHaveAttribute('aria-label', 'vine,, underlined');
    await expect.poll(async () => (await savedBible(elsewhere)).marks).toEqual({ '15001:4': 'underline' });
  });
});
