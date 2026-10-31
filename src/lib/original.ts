import { json } from './text';

/**
 * The original-language text of a chapter, word by word (SBLGNT Greek, WLC Hebrew, from
 * MACULA), built by scripts/build-original.mjs. Shown as itself, never matched word for
 * word to the English: the WEB's own matching (its Strong's tags) was measured wrong too
 * often to put before a preacher.
 */
export type Word = [text: string, translit: string, strong: string, gloss: string, parse: number, after: string, septuagint?: string, written?: number];
export interface OriginalChapter {
  lang: 'greek' | 'hebrew';
  /**
   * "differs": the Hebrew numbers the chapter's verses differently from the English, so
   * none is offered. "end-differs": the Greek divides the chapter's end differently (3
   * John 14-15), so its last verse here may be only part of the Greek's.
   */
  numbering?: 'differs' | 'end-differs';
  /**
   * Verses the WEB has that this Greek text doesn't, and why: "later" (found only in
   * later manuscripts, which the WEB follows), "joined" (the Greek numbers the words
   * with the verse before), "moved" (the Greek has them elsewhere: Romans 16:25-27).
   */
  absent?: Record<string, 'later' | 'joined' | 'moved'>;
  /** Grammar, as words; each word points into this. */
  parses: string[];
  verses: Record<string, Word[]>;
}
/** A Strong's entry: [lemma, transliteration, definition, KJV renderings, derivation]. */
export type Entry = [lemma: string, translit: string, def: string, kjv: string, derivation: string];

const chapters = new Map<string, Promise<OriginalChapter>>();
const buckets = new Map<string, Promise<Record<string, Entry>>>();

function once<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key);
  if (!p) {
    p = load();
    // A failure is not kept, so opening the verse again tries again.
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export const loadOriginal = (book: string, chapter: number) =>
  once(chapters, `${book}/${chapter}`, () => json<OriginalChapter>(`original/${book}/${chapter}.json`));

/** A Strong's entry ("G288", "H3068"), from files of a hundred entries. */
export async function loadEntry(strong: string): Promise<Entry | undefined> {
  // Extended numbers ("H3807a") have no entry of their own in Strong's.
  const m = /^([GH])(\d+)$/.exec(strong);
  if (!m) return undefined;
  const file = `${m[1]}${Math.floor(Number(m[2]) / 100)}`;
  const set = await once(buckets, file, () => json<Record<string, Entry>>(`strongs/${file}.json`));
  return set[strong];
}

/**
 * Hebrew writes some words as one (the "in" of "in the beginning" is a prefix). Each
 * part is its own entry, numbered with the written word it belongs to; this groups the
 * parts as the reader sees them. Grouping by "nothing follows this part" was wrong:
 * the data leaves nothing after whole words too, and "of David" ran into "LORD".
 * Greek words are never grouped.
 */
export function written(words: Word[]): Word[][] {
  const out: Word[][] = [];
  for (const w of words) {
    const last = out.at(-1);
    if (last && w[7] !== undefined && last[0][7] === w[7]) last.push(w);
    else out.push([w]);
  }
  return out;
}
