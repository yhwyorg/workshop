import { ALIASES, BY_CODE, fold } from './books';

/** chapter * 1000 + verse: one sortable number per verse. No chapter reaches 1000 verses. */
export type VerseKey = number;
export const key = (c: number, v: number): VerseKey => c * 1000 + v;
export const chapterOf = (k: VerseKey) => Math.floor(k / 1000);
export const verseOf = (k: VerseKey) => k % 1000;

/** A contiguous run of verses in one book. */
export interface Passage {
  book: string;
  start: VerseKey;
  end: VerseKey; // inclusive
}

/** Verse counts per chapter for every book, from public/text/en/books.json. */
export type Lengths = Record<string, number[]>;

export class RefError extends Error {}

/**
 * Reads what a pastor types: "John 15:1-11", "Ps 23", "1 Cor 13", "Gen 1:1-2:3",
 * "Jude 3" (one-chapter books take verse numbers directly). Anything it cannot
 * place is an error with a reason, never an empty passage: a pad opened on nothing
 * looks like a blank page that failed to load.
 */
export function parsePassage(input: string, lengths: Lengths): Passage {
  const s = input.normalize('NFKC').trim().replace(/[–—]/g, '-');
  const m = /^([1-3]?\s*[^\d\s][^\d]*?)\s*(\d[\d:\s,.-]*)?$/i.exec(s);
  if (!m) throw new RefError('Type a passage such as “John 15:1-11” or “Psalm 23”.');
  const code = ALIASES.get(fold(m[1]));
  if (!code) throw new RefError(`“${m[1].trim()}” isn’t a book of the Bible this workshop knows.`);
  const book = BY_CODE.get(code)!;
  const lens = lengths[code];
  if (!lens) throw new RefError(`The text of ${book.name} hasn’t loaded.`);
  const nums = (m[2] ?? '').replace(/\s/g, '').replace(/\./g, ':');
  if (!nums) throw new RefError(`Add a chapter, e.g. “${book.name} 1”.`);

  const one = lens.length === 1;
  const end = (c: number) => lens[c - 1];
  let start: VerseKey;
  let stop: VerseKey;
  let r: RegExpExecArray | null;
  if ((r = /^(\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$/.exec(nums))) {
    const c1 = Number(r[1]);
    const v1 = Number(r[2]);
    const c2 = r[3] ? Number(r[3]) : c1;
    const v2 = r[4] ? Number(r[4]) : v1;
    [start, stop] = [key(c1, v1), key(c2, v2)];
  } else if ((r = /^(\d+)(?:-(\d+))?$/.exec(nums))) {
    const a = Number(r[1]);
    const z = r[2] ? Number(r[2]) : a;
    // "Jude 3" and "Jude 3-5" are verses; "Psalm 23" and "Psalm 23-24" are chapters.
    [start, stop] = one ? [key(1, a), key(1, z)] : [key(a, 1), key(z, end(z) ?? 0)];
  } else {
    throw new RefError(`Can’t read “${nums}”. Try “${book.name} 1:1-5”.`);
  }

  for (const k of [start, stop]) {
    const c = chapterOf(k);
    if (!end(c)) throw new RefError(`${book.name} has ${lens.length} chapter${lens.length === 1 ? '' : 's'}, not ${c}.`);
    if (verseOf(k) < 1 || verseOf(k) > end(c)) {
      throw new RefError(`${book.name} ${c} has ${end(c)} verses, not ${verseOf(k)}.`);
    }
  }
  if (stop < start) throw new RefError(`${formatPassage({ book: code, start: stop, end: start })} is written backwards.`);
  return { book: code, start, end: stop };
}

export function formatPassage(p: Passage): string {
  const name = BY_CODE.get(p.book)?.name ?? p.book;
  const [c1, v1, c2, v2] = [chapterOf(p.start), verseOf(p.start), chapterOf(p.end), verseOf(p.end)];
  if (p.start === p.end) return `${name} ${c1}:${v1}`;
  if (c1 === c2) return `${name} ${c1}:${v1}-${v2}`;
  return `${name} ${c1}:${v1}-${c2}:${v2}`;
}

/** Every verse key in the passage, in order. */
export function versesIn(p: Passage, lens: number[]): VerseKey[] {
  const out: VerseKey[] = [];
  for (let c = chapterOf(p.start); c <= chapterOf(p.end); c++) {
    const from = c === chapterOf(p.start) ? verseOf(p.start) : 1;
    const to = c === chapterOf(p.end) ? verseOf(p.end) : lens[c - 1];
    for (let v = from; v <= to; v++) out.push(key(c, v));
  }
  return out;
}
