import { beginStudy, draw, expect, savedBible, savedStudies, show, stopTyping, test, twoFingerDrag, typeNotes } from './fixtures';

/**
 * The notes are for handwriting first. A Pencil, a finger or a mouse writes on them
 * with nothing to choose first; Type switches to the keyboard. (Before this, only the
 * Pencil wrote, the mouse needed a pen chosen, and a finger could only type.)
 */
const padStrokes = async (page: import('@playwright/test').Page) => (await savedStudies(page))[0]?.ink?.pad?.strokes?.length ?? 0;

test.describe('writing on the notes', () => {
  test('a finger writes on them', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'touch', [60, 160], [260, 170]);
    await expect.poll(() => padStrokes(page)).toBe(1);
    await expect(page.locator('.pad-surface svg.ink path')).toHaveCount(1);
  });

  test('a mouse writes on them, with no pen to choose first', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'mouse', [60, 160], [260, 170]);
    await expect.poll(() => padStrokes(page)).toBe(1);
  });

  test('the Pencil writes on them', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'pen', [60, 160], [260, 170]);
    await expect.poll(() => padStrokes(page)).toBe(1);
  });

  test('a finger still does not write on the Bible: it taps words and scrolls', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await draw(page, '.bible-text', 'touch', [40, 40], [200, 40]);
    await page.waitForTimeout(400);
    expect((await savedBible(page)).ink['15']).toBeUndefined();
  });

  test('once a Pencil has written, a resting palm or finger no longer does', async ({ page }) => {
    // As Apple Notes does once a Pencil is paired: with a Pencil in hand, a hand on the
    // glass would otherwise leave marks.
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'pen', [60, 160], [260, 170]);
    await expect.poll(() => padStrokes(page)).toBe(1);
    await draw(page, '.pad-surface', 'touch', [60, 220], [260, 230]);
    await page.reload();
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'touch', [60, 260], [260, 270]);
    await page.waitForTimeout(400);
    expect(await padStrokes(page)).toBe(1);
  });

  test('two fingers scroll the notes and leave no mark', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await typeNotes(page, Array.from({ length: 80 }, (_, i) => `Line ${i + 1}`).join('\n'));
    await stopTyping(page);
    const pane = page.getByRole('region', { name: 'Your notes', exact: true });
    expect(await pane.evaluate((el) => el.scrollTop)).toBe(0);
    await twoFingerDrag(page, '.pad-surface', [80, 300], -200);
    await expect.poll(() => pane.evaluate((el) => el.scrollTop)).toBeGreaterThan(150);
    await page.waitForTimeout(400);
    expect(await padStrokes(page)).toBe(0);
  });

  test('the page grows as it is written down, so there is always room below', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    const height = () => page.locator('.pad-surface').evaluate((el) => el.getBoundingClientRect().height);
    const before = await height();
    await draw(page, '.pad-surface', 'pen', [60, before - 20], [260, before - 10]);
    await expect.poll(height).toBeGreaterThan(before + 150);
  });
});

test.describe('writing or typing, without choosing', () => {
  // The user: "auto detect if someone is typing so we don't have to switch".
  test('typing on a keyboard while writing switches to typing, and no letter is lost', async ({ page }, info) => {
    test.skip(info.project.name === 'phone', 'the notes are a tab apart: the phone test below covers it');
    await beginStudy(page, 'John', 15);
    await expect(page.getByLabel('Notes', { exact: true })).toHaveAttribute('readonly', '');
    await page.keyboard.type('Abide in me.');
    await expect(page.getByLabel('Notes', { exact: true })).not.toHaveAttribute('readonly');
    await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('Abide in me.');
    await expect.poll(async () => (await savedStudies(page))[0]?.notes?.page).toBe('Abide in me.');
  });

  test('a Pencil on the notes while typing switches back to writing, read-only again', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await typeNotes(page, 'Abide.');
    await draw(page, '.pad-surface', 'pen', [60, 220], [260, 230]);
    await expect(page.getByLabel('Notes', { exact: true })).toHaveAttribute('readonly', '');
    await expect.poll(async () => (await savedStudies(page))[0]?.ink?.pad?.strokes?.length).toBe(1);
  });

  test('keys meant for something else are left to it', async ({ page }, info) => {
    test.skip(info.project.name === 'phone', 'the Bible and notes are a tab apart on a phone');
    await beginStudy(page, 'John', 15);
    // Space on a focused word marks it, as it always did.
    const vine = page.locator('.word').filter({ hasText: /^vine,$/ }).first();
    await vine.focus();
    await page.keyboard.press(' ');
    await expect(vine).toHaveAttribute('aria-pressed', 'true');
    // A shortcut isn't typing.
    await page.keyboard.press('Control+a');
    await expect(page.getByLabel('Notes', { exact: true })).toHaveAttribute('readonly', '');
    await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('');
  });

  test('typing with the notepad folded unfolds it, so the letters are seen', async ({ page }, info) => {
    test.skip(info.project.name === 'phone', 'a phone has no fold');
    await beginStudy(page, 'John', 15);
    await page.getByRole('button', { name: 'Fold the notepad' }).click();
    await expect(page.getByLabel('Notes', { exact: true })).toBeHidden();
    await page.keyboard.type('Vine');
    await expect(page.getByLabel('Notes', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('Vine');
  });

  test('on a phone, typing brings the notes to the front', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'phone only');
    await beginStudy(page, 'John', 15);
    await page.keyboard.type('Fruit');
    await expect(page.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('Fruit');
  });
});

test.describe('typing on the notes', () => {
  test('while writing, the page cannot be typed on, so iPad cannot turn the Pencil into text', async ({ page }) => {
    // iPadOS Scribble converts Pencil writing over any editable field into typed text.
    // A read-only page gives it nothing to convert; Scribble itself can't run here.
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await expect(page.getByLabel('Notes', { exact: true })).toHaveAttribute('readonly', '');
    await expect(page.getByLabel('Title', { exact: true })).toHaveAttribute('readonly', '');
  });

  test('tapping types, tapping away writes again, and both kinds of writing stay', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'pen', [60, 160], [260, 170]);
    await typeNotes(page, 'Abide.');
    await stopTyping(page);
    await expect(page.getByLabel('Notes', { exact: true })).toHaveAttribute('readonly', '');
    await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('Abide.');
    await expect(page.locator('.pad-surface svg.ink path')).toHaveCount(1);
    await expect.poll(async () => (await savedStudies(page))[0]?.notes?.page).toBe('Abide.');
  });

  test('after a reload the notes are ready for writing, with what was typed kept', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await typeNotes(page, 'Abide.');
    await expect.poll(async () => (await savedStudies(page))[0]?.notes?.page).toBe('Abide.');
    await page.reload();
    await show(page, 'Notes');
    await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('Abide.');
    await expect(page.getByLabel('Notes', { exact: true })).toHaveAttribute('readonly', '');
  });
});

test.describe('no switch between writing and typing', () => {
  // The user: "take out the write/type options since it autodetects now". A physical
  // keyboard can be detected, but an on-screen one only comes up for a box already tapped,
  // so on a phone or an iPad without a keyboard, a tap is what asks for it.
  const notes = (page: import('@playwright/test').Page) => page.getByLabel('Notes', { exact: true });
  const tap = (page: import('@playwright/test').Page, kind: 'touch' | 'pen', at: [number, number] = [80, 200]) =>
    draw(page, '.pad-surface', kind, at, [at[0] + 1, at[1] + 1]);
  const strokes = async (page: import('@playwright/test').Page) => (await savedStudies(page))[0]?.ink?.pad?.strokes?.length ?? 0;
  const typing = async (page: import('@playwright/test').Page) => {
    await expect(notes(page)).not.toHaveAttribute('readonly');
    await expect(notes(page)).toBeFocused();
  };

  test('there is nothing to choose', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await expect(page.getByRole('button', { name: 'Write', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Type', exact: true })).toHaveCount(0);
  });

  test('a finger’s tap brings the keyboard, and leaves no mark', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await tap(page, 'touch');
    await typing(page);
    await page.keyboard.type('Abide.');
    await expect(notes(page)).toHaveValue('Abide.');
    expect(await strokes(page)).toBe(0);
  });

  test('a mouse click does the same, and a drag writes', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'mouse', [60, 200], [260, 210]);
    await expect.poll(() => strokes(page)).toBe(1);
    await expect(notes(page)).toHaveAttribute('readonly', '');
    await notes(page).click({ position: { x: 40, y: 10 } });
    await typing(page);
    expect(await strokes(page)).toBe(1);
  });

  test('a finger’s drag writes, and doesn’t bring the keyboard', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'touch', [60, 200], [260, 210]);
    await expect.poll(() => strokes(page)).toBe(1);
    await expect(notes(page)).toHaveAttribute('readonly', '');
    await expect(notes(page)).not.toBeFocused();
  });

  test('a tap right after writing is the dot on an "i", not a request to type', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'touch', [60, 200], [260, 210]);
    await expect.poll(() => strokes(page)).toBe(1);
    await tap(page, 'touch', [120, 180]);
    await expect.poll(() => strokes(page)).toBe(2);
    await expect(notes(page)).toHaveAttribute('readonly', '');
  });

  test('the Pencil’s tap is a mark, never the keyboard', async ({ page }) => {
    // Scribble: an editable box under the Pencil would turn handwriting into typed text.
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await tap(page, 'pen');
    await expect.poll(() => strokes(page)).toBe(1);
    await expect(notes(page)).toHaveAttribute('readonly', '');
  });

  test('once a Pencil has been used, a palm just after it does nothing; a tap later types', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'pen', [60, 200], [260, 210]);
    await expect.poll(() => strokes(page)).toBe(1);
    // A hand coming to rest as the Pencil lifts.
    await tap(page, 'touch', [200, 260]);
    await page.waitForTimeout(150);
    await expect(notes(page)).toHaveAttribute('readonly', '');
    expect(await strokes(page)).toBe(1);
    await page.waitForTimeout(1600);
    await tap(page, 'touch', [200, 260]);
    await typing(page);
    expect(await strokes(page)).toBe(1);
  });

  test('tapping the title types the title', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    const title = page.getByLabel('Title', { exact: true });
    await title.click();
    await expect(title).toBeFocused();
    await expect(title).not.toHaveAttribute('readonly');
    await page.keyboard.type('The vine');
    await expect(title).toHaveValue('The vine');
    await expect(notes(page)).toHaveValue('');
  });

  test('moving from the title to the notes stays typing; leaving both goes back to writing', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    const title = page.getByLabel('Title', { exact: true });
    await title.click();
    await page.keyboard.press('Tab');
    await expect(notes(page)).toBeFocused();
    await expect(notes(page)).not.toHaveAttribute('readonly');
    await stopTyping(page);
    await expect(notes(page)).toHaveAttribute('readonly', '');
    await expect(title).toHaveAttribute('readonly', '');
  });
});
