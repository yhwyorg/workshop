import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import john from '../../public/xref/JOH.json';
import psalms from '../../public/xref/PSA.json';
import { BOOKS } from './books';
import lengths from '../../public/text/en/books.json';
import { chapterOf, key, verseOf } from './refs';
import { crossReferences, parseXref, testament, xrefLabel } from './xref';

describe('reading a cross-reference', () => {
  it('reads a verse, a run of verses, and a run across chapters', () => {
    expect(parseXref('JOH.3.16')).toEqual({ book: 'JOH', start: key(3, 16), end: key(3, 16) });
    expect(parseXref('ISA.5.1-7')).toEqual({ book: 'ISA', start: key(5, 1), end: key(5, 7) });
    expect(parseXref('MAT.5.48-6.1')).toEqual({ book: 'MAT', start: key(5, 48), end: key(6, 1) });
    expect(parseXref('1JO.4.9-10')).toEqual({ book: '1JO', start: key(4, 9), end: key(4, 10) });
  });

  it('refuses what it cannot read, rather than opening the wrong verse', () => {
    expect(() => parseXref('John 3:16')).toThrow(/unreadable/);
    expect(() => parseXref('JOH.3')).toThrow(/unreadable/);
  });

  it('is written as a reader writes it', () => {
    expect(xrefLabel(parseXref('ISA.5.1-7'))).toBe('Isaiah 5:1–7');
    expect(xrefLabel(parseXref('PHI.4.13'))).toBe('Philippians 4:13');
    expect(xrefLabel(parseXref('MAT.5.48-6.1'))).toBe('Matthew 5:48–6:1');
  });
});

describe('the testaments', () => {
  it('splits at Malachi and Matthew', () => {
    expect(testament('MAL')).toBe('old');
    expect(testament('MAT')).toBe('new');
    expect(BOOKS.filter((b) => testament(b.code) === 'old')).toHaveLength(39);
  });
});

describe('a verse’s cross-references', () => {
  it('puts a New Testament verse’s Old Testament roots first', () => {
    const [first, second] = crossReferences(john, 'JOH', 15, 1);
    expect(first.testament).toBe('old');
    expect(first.refs.map(xrefLabel)).toContain('Jeremiah 2:21');
    expect(second.testament).toBe('new');
    expect(second.refs.every((p) => testament(p.book) === 'new')).toBe(true);
  });

  it('puts where the New Testament takes up an Old Testament verse first', () => {
    const [first] = crossReferences(psalms, 'PSA', 22, 1);
    expect(first.testament).toBe('new');
    expect(first.refs.map(xrefLabel).slice(0, 2)).toEqual(['Mark 15:34', 'Matthew 27:46']);
  });

  it('is empty, not an error, for a verse with none', () => {
    expect(crossReferences(john, 'JOH', 99, 1).flatMap((g) => g.refs)).toEqual([]);
  });

  it('every reference in all 66 books can be read, and points at a verse this Bible has', () => {
    const bad: string[] = [];
    for (const { code } of BOOKS) {
      const x = JSON.parse(readFileSync(new URL(`../../public/xref/${code}.json`, import.meta.url), 'utf8')) as Record<string, Record<string, string[]>>;
      for (const [c, verses] of Object.entries(x)) for (const [v, refs] of Object.entries(verses)) for (const r of refs) {
        try {
          const p = parseXref(r);
          const last = (lengths as Record<string, number[]>)[p.book]?.[chapterOf(p.end) - 1] ?? 0;
          if (verseOf(p.end) > last) bad.push(`${code} ${c}:${v} → ${r} (no such verse)`);
        } catch {
          bad.push(`${code} ${c}:${v} → ${r}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
