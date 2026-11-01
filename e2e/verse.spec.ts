import type { Page } from '@playwright/test';
import { beginStudy, draw, expect, forgiveFailedLoads, recordedApi, savedBible, test } from './fixtures';

/**
 * Opening a verse: tap its number to see where else Scripture speaks to it (its Old
 * Testament roots first, for a New Testament verse) and what the commentaries say on
 * it. Cross-references are OpenBible.info's, served from this site; commentaries come
 * from the API, replaced here by recordings.
 */
const openVerse = async (page: Page, verse: number) => page.getByRole('button', { name: `Verse ${verse}`, exact: true }).click();
const panel = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true });

test.describe('opening a verse', () => {
  test('tapping a verse number shows the verse and where else Scripture speaks to it', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await openVerse(page, 5);
    const verse = panel(page, 'John 15:5');
    await expect(verse).toContainText('I am the vine. You are the branches.');
    // Its strongest cross-reference, with that verse's own words beside it.
    await expect(verse).toContainText('Philippians 4:13');
    await expect(verse).toContainText('I can do all things through Christ who strengthens me.');
  });

  test('for a New Testament verse, its Old Testament roots come first', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await openVerse(page, 1);
    const roots = panel(page, 'John 15:1').getByRole('region', { name: 'In the Old Testament' });
    await expect(roots).toContainText('Jeremiah 2:21');
    await expect(roots).toContainText('Yet I had planted you a noble vine');
    await expect(roots).toContainText('Isaiah 5:1–7');
  });

  test('for an Old Testament verse, where the New Testament takes it up', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'Psalms', 22);
    await openVerse(page, 1);
    const later = panel(page, 'Psalms 22:1').getByRole('region', { name: 'In the New Testament' });
    await expect(later).toContainText('Mark 15:34');
    await expect(later).toContainText('Matthew 27:46');
  });

  test('a cross-reference can be followed, and the way back is kept', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await openVerse(page, 1);
    await panel(page, 'John 15:1').getByRole('button', { name: 'Jeremiah 2:21', exact: true }).click();
    const jer = panel(page, 'Jeremiah 2:21');
    await expect(jer).toContainText('Yet I had planted you a noble vine');
    await expect(jer.getByRole('region', { name: 'In the Old Testament' })).not.toBeEmpty();
    await jer.getByRole('button', { name: 'Back to John 15:1' }).click();
    await expect(panel(page, 'John 15:1')).toContainText('I am the true vine');
  });

  test('the commentaries each give the note that covers the verse', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await openVerse(page, 5);
    const said = panel(page, 'John 15:5').getByRole('region', { name: 'From the commentaries' });
    // Tyndale's note begins at verse 4, JFB's at 5, Henry's at 1: each says where.
    await expect(said).toContainText('The term remain (Greek menō)');
    await expect(said).toContainText('Tyndale Open Study Notes · from verse 4');
    await expect(said).toContainText('without me--apart');
    await expect(said).toContainText('Jamieson, Fausset & Brown · on verse 5');
    await expect(said).toContainText('Matthew Henry · from verse 1');
  });

  test('a commentary whose notes begin later gives its word on the chapter instead', async ({ page }) => {
    // JFB's notes on Psalm 22 begin at verse 2; what it says of verse 1 is in its
    // introduction to the psalm. "Nothing on this verse" was true but unhelpful.
    await recordedApi(page);
    await beginStudy(page, 'Psalms', 22);
    await openVerse(page, 1);
    const said = panel(page, 'Psalms 22:1').getByRole('region', { name: 'From the commentaries' });
    await expect(said).toContainText('Jamieson, Fausset & Brown · on the chapter');
    await expect(said).toContainText('Aijeleth Shahar');
  });

  test('when the commentaries cannot be reached it says so, and the cross-references still show', async ({ page, errors }) => {
    await recordedApi(page, { down: true });
    await beginStudy(page, 'John', 15);
    await openVerse(page, 5);
    const verse = panel(page, 'John 15:5');
    await expect(verse.getByRole('region', { name: 'From the commentaries' }).getByRole('alert').first()).toContainText('couldn’t be reached');
    await expect(verse).toContainText('Philippians 4:13');
    forgiveFailedLoads(errors);
  });

  test('it closes with the close button or Escape, and nothing is marked or written', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await openVerse(page, 5);
    await page.getByRole('button', { name: 'Close John 15:5' }).click();
    await expect(panel(page, 'John 15:5')).toHaveCount(0);
    await openVerse(page, 6);
    await page.keyboard.press('Escape');
    await expect(panel(page, 'John 15:6')).toHaveCount(0);
    const b = await savedBible(page);
    expect(b.marks).toEqual({});
    expect(b.ink['15']).toBeUndefined();
  });

  test('a Pencil on a verse number writes; it does not open the verse', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    const n = (await page.getByRole('button', { name: 'Verse 5', exact: true }).boundingBox())!;
    const s = (await page.locator('.bible-text').boundingBox())!;
    const at: [number, number] = [n.x - s.x + n.width / 2, n.y - s.y + n.height / 2];
    await draw(page, '.bible-text', 'pen', at, [at[0] + 1, at[1] + 1]);
    await page.getByRole('button', { name: 'Verse 5', exact: true }).dispatchEvent('click');
    await expect.poll(async () => (await savedBible(page)).ink['15']?.strokes?.length).toBe(1);
    await expect(panel(page, 'John 15:5')).toHaveCount(0);
  });
});

test.describe('the Greek and Hebrew, without aiming at a verse number', () => {
  // The user: "more accessibility for the translation button. These are older pastors."
  // A verse number is a small target, and a Pencil tap on one writes; so a button says
  // what it does, and then a tap anywhere in a verse opens it.
  const word = (page: Page, text: RegExp) => page.locator('.word').filter({ hasText: text }).first();

  test('a button named for the language turns it on; then a tap on any word opens its verse', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    const greek = page.getByRole('button', { name: 'Greek', exact: true });
    await greek.click();
    await expect(greek).toHaveAttribute('aria-pressed', 'true');
    // On screen, not just on the page: it once sat unseen at the chapter's end.
    await expect(page.getByText('Tap a verse to see it in the Greek')).toBeInViewport();
    await word(page, /^branches\.$/).click();
    await expect(panel(page, 'John 15:5').getByRole('region', { name: 'In the Greek' })).toBeVisible();
    // Looking, not marking.
    expect((await savedBible(page)).marks).toEqual({});
  });

  test('the Old Testament says Hebrew', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'Psalms', 23);
    await page.getByRole('button', { name: 'Hebrew', exact: true }).click();
    await word(page, /^shepherd;?$/).click();
    await expect(panel(page, 'Psalms 23:1').getByRole('region', { name: 'In the Hebrew' })).toBeVisible();
  });

  test('a Pencil tap looks a verse up too, and writes nothing', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await page.getByRole('button', { name: 'Greek', exact: true }).click();
    const w = (await word(page, /^branches\.$/).boundingBox())!;
    const s = (await page.locator('.bible-text').boundingBox())!;
    const at: [number, number] = [w.x - s.x + w.width / 2, w.y - s.y + w.height / 2];
    await draw(page, '.bible-text', 'pen', at, [at[0] + 1, at[1] + 1]);
    await word(page, /^branches\.$/).dispatchEvent('click');
    await expect(panel(page, 'John 15:5')).toBeVisible();
    await page.waitForTimeout(400);
    expect((await savedBible(page)).ink['15']).toBeUndefined();
  });

  test('pressed again, a tap marks a word as before', async ({ page }) => {
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    const greek = page.getByRole('button', { name: 'Greek', exact: true });
    await greek.click();
    await greek.click();
    await expect(greek).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('Tap a verse to see it in the Greek')).toHaveCount(0);
    await word(page, /^vine,$/).click();
    await expect(word(page, /^vine,$/)).toHaveAttribute('aria-pressed', 'true');
    await expect(panel(page, 'John 15:1')).toHaveCount(0);
  });

  test('choosing a pen ends looking up', async ({ page }, info) => {
    test.skip(info.project.name === 'phone', 'a phone has no pens');
    await recordedApi(page);
    await beginStudy(page, 'John', 15);
    await page.getByRole('button', { name: 'Greek', exact: true }).click();
    await page.getByRole('button', { name: 'Eraser', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Greek', exact: true })).toHaveAttribute('aria-pressed', 'false');
  });

  test('a verse number can be tapped anywhere within 12 px of its middle', async ({ page }) => {
    // 24 by 24 px, the smallest target WCAG 2.2 allows (2.5.8). It was 20 wide.
    await beginStudy(page, 'John', 15);
    const n = page.getByRole('button', { name: 'Verse 5', exact: true });
    const b = (await n.boundingBox())!;
    const [cx, cy] = [b.x + b.width / 2, b.y + b.height / 2];
    const hits = await page.evaluate(
      ([cx, cy]) => [[-11, 0], [11, 0], [0, -11], [0, 11]].map(([dx, dy]) => document.elementFromPoint(cx + dx, cy + dy)?.getAttribute('aria-label')),
      [cx, cy],
    );
    expect(hits).toEqual(['Verse 5', 'Verse 5', 'Verse 5', 'Verse 5']);
  });
});
