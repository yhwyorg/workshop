import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import lengths from '../../public/text/en/books.json';
import { BOOKS } from './books';
import { written, type Entry, type OriginalChapter, type Word } from './original';
import { testament } from './xref';

const read = <T>(path: string): T => JSON.parse(readFileSync(new URL(`../../public/${path}`, import.meta.url), 'utf8')) as T;

describe('the original-language text', () => {
  it('has a file for every chapter of all 66 books, in the right language, every word well formed', () => {
    const bad: string[] = [];
    for (const { code } of BOOKS) {
      (lengths as Record<string, number[]>)[code].forEach((verses, i) => {
        const path = `original/${code}/${i + 1}.json`;
        if (!existsSync(new URL(`../../public/${path}`, import.meta.url))) return bad.push(`${path} missing`);
        const ch = read<OriginalChapter>(path);
        if (ch.lang !== (testament(code) === 'old' ? 'hebrew' : 'greek')) bad.push(`${path} is ${ch.lang}`);
        for (const [v, ws] of Object.entries(ch.verses)) {
          for (const w of ws) {
            if (!w[0] || !/^[GH]\d+[a-z]?$|^$/.test(w[2]) || !(w[4] >= 0 && w[4] < ch.parses.length)) bad.push(`${code} ${i + 1}:${v} ${JSON.stringify(w)}`);
          }
        }
        // Offered verses must be ones the English chapter has.
        if (ch.numbering !== 'differs' && Object.keys(ch.verses).some((v) => Number(v) > verses)) bad.push(`${path} has verses past ${verses}`);
      });
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('says why a verse is missing from the Greek, rather than leaving it empty or guessing', () => {
    expect(read<OriginalChapter>('original/JOH/5.json').absent).toEqual({ 4: 'later' });
    // In the Greek, numbered with 13:13; not a later addition.
    expect(read<OriginalChapter>('original/2CO/13.json').absent).toEqual({ 14: 'joined' });
    // The doxology the WEB has at Romans 14:24-26 is at 16:25-27 in the Greek.
    expect(read<OriginalChapter>('original/ROM/14.json').absent).toEqual({ 24: 'moved', 25: 'moved', 26: 'moved' });
    // The WEB leaves Acts 8:37 empty (a footnote), so it isn't shown and needs no reason.
    expect(read<OriginalChapter>('original/ACT/8.json').absent).toEqual({});
  });

  it('offers no Hebrew verses where the Hebrew numbers the chapter differently', () => {
    // Psalm 51's title is two verses in Hebrew; Malachi 4 is Hebrew 3:19-24.
    for (const path of ['original/PSA/51.json', 'original/MAL/4.json']) {
      const ch = read<OriginalChapter>(path);
      expect(ch.numbering, path).toBe('differs');
      expect(ch.verses, path).toEqual({});
    }
  });

  it('gives John 15:5 as the Greek has it', () => {
    const ch = read<OriginalChapter>('original/JOH/15.json');
    expect(ch.verses[5].slice(0, 4).map((w) => w[0])).toEqual(['ἐγώ', 'εἰμι', 'ἡ', 'ἄμπελος']);
    expect(ch.verses[5][3].slice(1, 4)).toEqual(['ampelos', 'G288', 'vine']);
  });
});

describe('Hebrew written words', () => {
  it('groups a prefix with the word it is written on, and nothing else', () => {
    const w = (text: string, after: string, n: number): Word => [text, '', '', '', 0, after, '', n];
    expect(written([w('בְּ', '', 1), w('רֵאשִׁית', ' ', 1), w('בָּרָא', ' ', 2)]).map((g) => g.map((x) => x[0]))).toEqual([['בְּ', 'רֵאשִׁית'], ['בָּרָא']]);
  });

  it('keeps "of David" apart from "LORD" in Psalm 23:1', () => {
    // The data leaves nothing after "David" too; grouping by that ran them together.
    const ps = read<OriginalChapter>('original/PSA/23.json');
    expect(written(ps.verses[1]).map((g) => g.map((x) => x[3]).join(' ')).slice(0, 3)).toEqual(['psalm', 'of David', 'LORD']);
  });

  it('never gives a word another word\u2019s dictionary entry', () => {
    // "of" (3807a) is not H3807, "to bruise"; "created" (1254a) is H1254, bara.
    const ps = read<OriginalChapter>('original/PSA/23.json');
    expect(ps.verses[1][1][2]).toBe('H3807a');
    expect(read<OriginalChapter>('original/GEN/1.json').verses[1].find((x) => x[3] === 'created')?.[2]).toBe('H1254');
  });
});

describe('Strong’s dictionaries', () => {
  it('give the lemma and meaning of a Greek and a Hebrew word', () => {
    const greek = read<Record<string, Entry>>('strongs/G2.json')['G288'];
    expect(greek[0]).toBe('ἄμπελος');
    expect(greek[2]).toMatch(/vine/);
    const hebrew = read<Record<string, Entry>>('strongs/H30.json')['H3068'];
    expect(hebrew[0]).toBe('יְהֹוָה');
  });
});
