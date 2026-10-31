import { json } from './text';

/**
 * How a chapter is set on the page, as a printed Bible sets it: paragraphs, poetry
 * lines, psalm titles, headings, and which words are Jesus' own. Built from the WEB's
 * USFM edition by scripts/build-layout.mjs, as word positions in the verses the page
 * already shows, so marks (keyed by word) mean the same words either way.
 */
export type Style = 'p' | 'm' | 'nb' | 'pi' | 'q1' | 'q2' | 'q3' | 'd' | 'qa' | 'b' | 'sp';
/** [verse, fromWord, toWord), words counted as the page counts them (split on spaces). */
export type Part = [number, number, number];
export type Block = [Style, Part[]] | ['h', 'ms' | 'sp' | 's', string];
export interface ChapterLayout {
  blocks: Block[];
  /** The words of Jesus, by verse: [fromWord, toWord) runs. */
  wj: Record<string, [number, number][]>;
}

/**
 * The layout this build sets chapters in. Ink records it; ink written before chapters
 * were set this way (no layout) keeps the plain setting it was written on, because
 * paragraphs and poetry lines move every word that follows them.
 */
export const LAYOUT = 2;

const cache = new Map<string, Promise<ChapterLayout[]>>();

export function loadLayout(book: string): Promise<ChapterLayout[]> {
  let p = cache.get(book);
  if (!p) {
    p = json<ChapterLayout[]>(`text/en/layout/${book}.json`);
    p.catch(() => cache.delete(book));
    cache.set(book, p);
  }
  return p;
}

/**
 * Checks that a chapter's layout sets every word of every verse exactly once, in order.
 * A layout that skipped or repeated a word would hide Scripture or put a mark on the
 * wrong word, so a chapter that fails is shown plain instead.
 */
export function coversExactly(layout: ChapterLayout, verses: string[]): boolean {
  const next = verses.map(() => 0);
  for (const b of layout.blocks) {
    if (b[0] === 'h') continue;
    for (const [v, from, to] of b[1] as Part[]) {
      if (v < 1 || v > verses.length || next[v - 1] !== from || to <= from) return false;
      next[v - 1] = to;
    }
  }
  return verses.every((text, i) => next[i] === text.split(/\s+/).filter(Boolean).length);
}

/** Whether word `i` of a verse is among Jesus' words. */
export const spoken = (layout: ChapterLayout, verse: number, i: number) =>
  (layout.wj[verse] ?? []).some(([from, to]) => i >= from && i < to);
