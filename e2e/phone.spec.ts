import type { Page } from '@playwright/test';
import { beginStudy, draw, expect, savedStudies, show, test } from './fixtures';

/**
 * A phone is for reading and for typing a quick note. Measured on the live site before
 * this: a finger's swipe to scroll the notes drew a line instead, and a phone's toolbar
 * has no Undo or eraser, so the line could never be taken off.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) >= 600, 'phone only');

const notes = (page: Page) => page.getByLabel('Notes', { exact: true });
const strokes = async (page: Page) => (await savedStudies(page))[0]?.ink?.pad?.strokes?.length ?? 0;

test.describe('the notes on a phone', () => {
  test('a swipe scrolls them, and leaves no mark', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'touch', [60, 100], [70, 300]);
    await page.waitForTimeout(400);
    expect(await strokes(page)).toBe(0);
    await expect(notes(page)).not.toBeFocused();
    const surface = page.locator('.pad-surface:not(.print-page)');
    // The browser only scrolls for a finger if neither of these stops it.
    expect(await surface.evaluate((el) => getComputedStyle(el).touchAction)).not.toBe('none');
    const carriedOn = await surface.evaluate((el) => el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true })));
    expect(carriedOn).toBe(true);
  });

  test('a mouse in a window this narrow doesn’t write either: there is no Undo here', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'mouse', [60, 200], [260, 210]);
    await page.waitForTimeout(400);
    expect(await strokes(page)).toBe(0);
  });

  test('says what a tap does, and doesn’t offer handwriting', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await expect(notes(page)).toHaveAttribute('placeholder', 'Tap to type…');
  });

  test('a tap still brings the keyboard', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'touch', [80, 200], [81, 201]);
    await expect(notes(page)).toBeFocused();
    await page.keyboard.type('Abide.');
    await expect(notes(page)).toHaveValue('Abide.');
    expect(await strokes(page)).toBe(0);
  });

  test('ink written on an iPad and brought over in a backup still shows', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem('workshop:store')!);
      store.pads[0].ink = { pad: { width: 460, strokes: [{ tool: 'pen', pts: [10, 200, 0.5, 200, 210, 0.5] }] } };
      localStorage.setItem('workshop:store', JSON.stringify(store));
    });
    await page.reload();
    await show(page, 'Notes');
    await expect(page.locator('.pad-surface:not(.print-page) .ink path')).toHaveCount(1);
  });

  test('while typing, the toolbar steps aside and the page has room to scroll above the keyboard', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    const before = await page.locator('.notes-pane').evaluate((el) => getComputedStyle(el).paddingBottom);
    await expect(page.getByRole('toolbar', { name: 'Study' })).toBeVisible();
    await draw(page, '.pad-surface', 'touch', [80, 200], [81, 201]);
    await expect(notes(page)).toBeFocused();
    await expect(page.getByRole('toolbar', { name: 'Study' })).toBeHidden();
    const typing = await page.locator('.notes-pane').evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
    expect(typing).toBeGreaterThan(parseFloat(before));
    expect(typing).toBeGreaterThanOrEqual(page.viewportSize()!.height * 0.5);
  });

  test('leaving the notes by their tab brings the toolbar back', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await draw(page, '.pad-surface', 'touch', [80, 200], [81, 201]);
    await expect(notes(page)).toBeFocused();
    await page.getByRole('tab', { name: 'Bible', exact: true }).click();
    await expect(page.getByRole('toolbar', { name: 'Study' })).toBeVisible();
    await expect(page.locator('.scripture')).toBeInViewport();
  });
});

const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Study' });
const solid = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    const c = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)!.map(Number);
    return c.length === 3 || c[3] === 1;
  });

test.describe('the toolbar on a phone', () => {
  test('is docked along the bottom and solid, so it doesn’t lie across the verses', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    const b = (await toolbar(page).boundingBox())!;
    const v = page.viewportSize()!;
    expect(b.x).toBe(0);
    expect(b.width).toBe(v.width);
    expect(b.y + b.height).toBe(v.height);
    expect(await solid(page, '.toolbar')).toBe(true);
    await expect(page.getByRole('button', { name: 'Move the toolbar' })).toBeHidden();
  });

  test('the end of a chapter can be read clear of it', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await page.locator('.scripture').waitFor();
    const pane = page.getByRole('region', { name: 'Bible', exact: true });
    await pane.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    const end = (await page.getByText('World English Bible').boundingBox())!;
    expect(end.y + end.height).toBeLessThanOrEqual((await toolbar(page).boundingBox())!.y);
  });

  for (const [width, book, chapter] of [[320, '1 Thessalonians', 5], [375, '2 Chronicles', 36], [390, 'Song of Songs', 2]] as const) {
    test(`keeps one row and every button at ${width}px, in ${book}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 600 });
      await beginStudy(page, book, chapter);
      expect((await toolbar(page).boundingBox())!.height).toBeLessThan(60);
      for (const name of ['Menu', 'Previous chapter', 'Next chapter', 'Compare', 'Minimize the toolbar']) {
        await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
      }
      const place = page.locator('.tb-place');
      expect((await place.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await place.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    });
  }

  test('says "Greek" in words where there is room', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 664 });
    await beginStudy(page, 'John', 15);
    await expect(page.locator('.tb-look-word')).toBeVisible();
    await expect(page.locator('.tb-look-letters')).toBeHidden();
  });

  test('ignores a spot it was moved to on a wider screen', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await page.evaluate(() => localStorage.setItem('workshop:toolbar-spot', JSON.stringify({ x: 20, y: 120 })));
    await page.reload();
    const b = (await toolbar(page).boundingBox())!;
    expect(b.y + b.height).toBe(page.viewportSize()!.height);
  });

  test('tucked, it is a small solid button, and comes back docked', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await page.getByRole('button', { name: 'Minimize the toolbar', exact: true }).click();
    const small = (await toolbar(page).boundingBox())!;
    expect(small.width).toBeLessThan(130);
    expect(await solid(page, '.toolbar')).toBe(true);
    await page.getByRole('button', { name: 'Show the toolbar', exact: true }).click();
    expect((await toolbar(page).boundingBox())!.width).toBe(page.viewportSize()!.width);
  });
});

test.describe('what opens above the toolbar on a phone', () => {
  for (const [name, button] of [['the chapters', /^John 15$/], ['the Compare list', /^Compare$/]] as const) {
    test(`${name} are solid, and clear of it`, async ({ page }) => {
      await beginStudy(page, 'John', 15);
      await page.getByRole('button', { name: button }).click();
      const panel = page.locator('.chapter-picker');
      await expect(panel).toBeVisible();
      expect(await solid(page, '.chapter-picker')).toBe(true);
      const p = (await panel.boundingBox())!;
      expect(p.y + p.height).toBeLessThanOrEqual((await toolbar(page).boundingBox())!.y);
    });
  }
});

test.describe('the tabs on a phone', () => {
  test('are 44px tall and share the width', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    const t = (await page.getByRole('tab', { name: 'Bible', exact: true }).boundingBox())!;
    expect(t.height).toBeGreaterThanOrEqual(44);
    expect(t.width).toBeGreaterThan(page.viewportSize()!.width / 2 - 30);
  });

  test('the menu’s Close is 44px', async ({ page }) => {
    await beginStudy(page, 'John', 15);
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const c = (await page.getByRole('button', { name: 'Close', exact: true }).boundingBox())!;
    expect(c.width).toBeGreaterThanOrEqual(44);
    expect(c.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('pages of notes on a phone', () => {
  for (const width of [320, 375, 390]) {
    test(`the controls stay one row at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 600 });
      await beginStudy(page, 'John', 15);
      await show(page, 'Notes');
      await page.getByRole('button', { name: 'Add a page', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Remove this page' })).toBeVisible();
      const bar = (await page.locator('.notes-bar').boundingBox())!;
      expect(bar.height).toBeLessThan(60);
      expect(bar.x + bar.width).toBeLessThanOrEqual(width);
      for (const name of ['Previous page', 'Next page', 'Add a page', 'Remove this page']) {
        await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
      }
    });
  }
});

test.describe('a phone on its side', () => {
  const sideways = async (page: Page) => {
    await page.setViewportSize({ width: 667, height: 340 });
    await beginStudy(page, 'John', 15);
  };

  test('is still a phone: one pane, a tap apart, and most of the screen to read', async ({ page }) => {
    await sideways(page);
    await expect(page.locator('.scripture')).toBeInViewport();
    await expect(page.locator('.notes-pane')).toBeHidden();
    const pane = (await page.getByRole('region', { name: 'Bible', exact: true }).boundingBox())!;
    const bar = (await toolbar(page).boundingBox())!;
    expect(bar.height).toBeLessThan(60);
    expect(bar.y - pane.y).toBeGreaterThan(340 * 0.75);
    await page.getByRole('tab', { name: 'Notes', exact: true }).click();
    await expect(page.getByLabel('Notes', { exact: true })).toBeInViewport();
  });

  test('the tabs join the toolbar’s row without covering a button', async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 340 });
    await beginStudy(page, '2 Chronicles', 36);
    const tabs = (await page.locator('.pane-tabs').boundingBox())!;
    expect(tabs.y + tabs.height).toBeLessThanOrEqual(340);
    expect(tabs.x + tabs.width).toBeLessThanOrEqual(667);
    const last = (await page.getByRole('button', { name: 'Minimize the toolbar', exact: true }).boundingBox())!;
    expect(last.x + last.width).toBeLessThanOrEqual(tabs.x);
  });

  test('what opens above the toolbar still fits on the short screen', async ({ page }) => {
    await sideways(page);
    await page.getByRole('button', { name: 'John 15', exact: true }).click();
    const p = (await page.locator('.chapter-picker').boundingBox())!;
    expect(p.y).toBeGreaterThanOrEqual(0);
    await expect(page.getByRole('button', { name: '15', exact: true })).toBeVisible();
  });
});

test.describe('a phone’s touch', () => {
  test('nothing stays tinted after a tap: hover is for a real pointer only', async ({ page }) => {
    await page.goto('/#/new');
    await page.getByRole('button', { name: 'John', exact: true }).waitFor();
    const loose = await page.evaluate(() => {
      const found: string[] = [];
      const walk = (rules: CSSRuleList, safe: boolean) => {
        for (const r of Array.from(rules)) {
          if (r instanceof CSSMediaRule) walk(r.cssRules, safe || /hover:\s*hover/.test(r.conditionText));
          else if (r instanceof CSSStyleRule && r.selectorText.includes(':hover') && !safe) found.push(r.selectorText);
        }
      };
      for (const sheet of Array.from(document.styleSheets)) walk(sheet.cssRules, false);
      return found;
    });
    expect(loose).toEqual([]);
  });

  test('no box zooms the page when tapped: every one is at least 16px', async ({ page }) => {
    const size = (selector: string) => page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    await beginStudy(page, 'John', 15);
    await show(page, 'Notes');
    await page.getByRole('button', { name: 'Add a page', exact: true }).click();
    expect(await size('.pager-which')).toBeGreaterThanOrEqual(16);
    expect(await size('textarea.pad-lines')).toBeGreaterThanOrEqual(16);
    await page.goto('/#/new');
    await page.getByRole('button', { name: 'John', exact: true }).click();
    expect(await size('.typed input')).toBeGreaterThanOrEqual(16);
  });
});

test.describe('choosing a book on a phone', () => {
  test('every book is a 44px target', async ({ page }) => {
    await page.goto('/#/new');
    const heights = await page.locator('.book-list button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(heights).toHaveLength(66);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  });

  test('the New Testament is a tap away, past twenty rows of the Old', async ({ page }) => {
    await page.goto('/#/new');
    const matthew = page.getByRole('button', { name: 'Matthew', exact: true });
    await expect(matthew).not.toBeInViewport();
    await page.getByRole('button', { name: 'The New Testament ›', exact: true }).click();
    await expect(matthew).toBeInViewport({ ratio: 1 });
  });

  test('going back to all books is a 44px target', async ({ page }) => {
    await page.goto('/#/new');
    await page.getByRole('button', { name: 'John', exact: true }).click();
    expect((await page.getByRole('button', { name: '‹ All books' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
});
