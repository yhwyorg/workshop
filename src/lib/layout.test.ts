import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOOKS } from './books';
import { coversExactly, spoken, type ChapterLayout } from './layout';

const read = <T>(path: string): T => JSON.parse(readFileSync(new URL(`../../public/text/en/${path}`, import.meta.url), 'utf8')) as T;

describe('the layout of every chapter', () => {
  it('sets every word of every verse exactly once, in order, in all 66 books', () => {
    // Marks and ink are keyed by word: a word lost or set twice would move them.
    const bad: string[] = [];
    for (const { code } of BOOKS) {
      const text = read<string[][]>(`${code}.json`);
      const layout = read<ChapterLayout[]>(`layout/${code}.json`);
      if (layout.length !== text.length) bad.push(`${code}: ${layout.length} chapters laid out, ${text.length} in the text`);
      text.forEach((verses, c) => layout[c] && !coversExactly(layout[c], verses) && bad.push(`${code} ${c + 1}`));
    }
    expect(bad).toEqual([]);
  });
});

describe('checking a layout', () => {
  const verses = ['In the beginning was the Word,', 'and the Word was God.'];
  it('accepts a layout that sets each word once', () => {
    expect(coversExactly({ blocks: [['p', [[1, 0, 6], [2, 0, 2]]], ['q1', [[2, 2, 5]]]], wj: {} }, verses)).toBe(true);
  });
  it('refuses one that skips a word, repeats one, or leaves one out at the end', () => {
    expect(coversExactly({ blocks: [['p', [[1, 0, 5], [2, 0, 5]]]], wj: {} }, verses)).toBe(false);
    expect(coversExactly({ blocks: [['p', [[1, 0, 6], [1, 5, 6], [2, 0, 5]]]], wj: {} }, verses)).toBe(false);
    expect(coversExactly({ blocks: [['p', [[1, 0, 6], [2, 0, 4]]]], wj: {} }, verses)).toBe(false);
  });
});

describe('the words of Jesus', () => {
  const john = read<ChapterLayout[]>('layout/JOH.json');
  it('are marked through John 15, which he speaks', () => {
    expect(spoken(john[14], 1, 0)).toBe(true);
    expect(spoken(john[14], 27, 0)).toBe(true);
  });
  it('are not marked in the narrator’s words', () => {
    // John 1:1 is the evangelist's.
    expect(spoken(john[0], 1, 0)).toBe(false);
  });
});

describe('poetry', () => {
  it('sets Psalm 23 in lines under its title', () => {
    const ps23 = read<ChapterLayout[]>('layout/PSA.json')[22];
    expect(ps23.blocks[0][0]).toBe('d');
    expect(ps23.blocks.slice(1, 3).map((b) => b[0])).toEqual(['q1', 'q2']);
  });
});
