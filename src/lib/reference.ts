/**
 * Reference texts shown beside the Bible: other translations, and commentaries.
 *
 * They come from the Free Use Bible API (bible.helloao.org), one chapter at a time
 * as it is read, rather than being copied into this site: Matthew Henry alone is
 * about 68 KB a chapter. The API serves public-domain texts (and Tyndale's notes
 * under CC BY-SA), allows browser use from any site, and asks browsers to cache each
 * chapter for a day. Everything that knows about the API is in this file, so the
 * source can be swapped for a self-hosted copy without touching the page.
 *
 * Every response is checked before it is shown. "This commentary does not cover the
 * book" and "it could not be loaded" are different answers and are never shown alike.
 */

const API = 'https://bible.helloao.org/api';

export interface Reference {
  /** Our id, kept in storage. */
  id: string;
  kind: 'translation' | 'commentary';
  name: string;
  /** For tabs and buttons. */
  short: string;
  /** The API's id for it. */
  api: string;
  licence: 'Public domain' | 'CC BY-SA 4.0';
  /** Required where the licence asks for credit. */
  attribution?: string;
  /** Old Testament only, or similar; shown in the picker. */
  scope?: string;
}

export const REFERENCES: Reference[] = [
  { id: 'kjv', kind: 'translation', name: 'King James Version', short: 'KJV', api: 'eng_kjv', licence: 'Public domain' },
  { id: 'bsb', kind: 'translation', name: 'Berean Standard Bible', short: 'BSB', api: 'BSB', licence: 'Public domain' },
  { id: 'asv', kind: 'translation', name: 'American Standard Version (1901)', short: 'ASV', api: 'eng_asv', licence: 'Public domain' },
  { id: 'ylt', kind: 'translation', name: 'Young’s Literal Translation', short: 'YLT', api: 'eng_ylt', licence: 'Public domain' },
  { id: 'geneva', kind: 'translation', name: 'Geneva Bible (1599)', short: 'Geneva', api: 'eng_gnv', licence: 'Public domain' },
  { id: 'matthew-henry', kind: 'commentary', name: 'Matthew Henry', short: 'Henry', api: 'matthew-henry', licence: 'Public domain' },
  { id: 'jamieson-fausset-brown', kind: 'commentary', name: 'Jamieson, Fausset & Brown', short: 'JFB', api: 'jamieson-fausset-brown', licence: 'Public domain' },
  { id: 'john-calvin', kind: 'commentary', name: 'John Calvin', short: 'Calvin', api: 'john-calvin', licence: 'Public domain', scope: 'most books' },
  { id: 'john-gill', kind: 'commentary', name: 'John Gill', short: 'Gill', api: 'john-gill', licence: 'Public domain' },
  { id: 'adam-clarke', kind: 'commentary', name: 'Adam Clarke', short: 'Clarke', api: 'adam-clarke', licence: 'Public domain', scope: 'most books' },
  { id: 'keil-delitzsch', kind: 'commentary', name: 'Keil & Delitzsch', short: 'K&D', api: 'keil-delitzsch', licence: 'Public domain', scope: 'Old Testament' },
  {
    id: 'tyndale', kind: 'commentary', name: 'Tyndale Open Study Notes', short: 'Tyndale', api: 'tyndale', licence: 'CC BY-SA 4.0',
    attribution: 'Tyndale Open Study Notes © Tyndale House Publishers, CC BY-SA 4.0, via the Free Use Bible API (format changed to JSON).',
  },
];

/**
 * eBible's book codes (ours, naming the files in public/text/en) -> the USFM codes the
 * API uses. Eleven differ; a wrong one returns a 404 that would read as "nothing on
 * John". reference.test.ts checks all 66 against the API's own list.
 */
const USFM: Record<string, string> = {
  SOL: 'SNG', EZE: 'EZK', JOE: 'JOL', NAH: 'NAM', MAR: 'MRK', JOH: 'JHN', PHI: 'PHP', JAM: 'JAS', '1JO': '1JN', '2JO': '2JN', '3JO': '3JN',
};
export const usfm = (code: string) => USFM[code] ?? code;

export const chapterUrl = (r: Reference, book: string, chapter: number) =>
  `${API}/${r.kind === 'commentary' ? `c/${r.api}` : r.api}/${usfm(book)}/${chapter}.json`;

export interface TranslationChapter {
  verses: { number: number; text: string }[];
  /** Section headings, by the verse they stand before. */
  headings: Record<number, string>;
}
export interface CommentaryChapter {
  introduction?: string[];
  notes: { verse: number; paragraphs: string[] }[];
}

export type Loaded =
  | ({ state: 'translation' } & TranslationChapter)
  | ({ state: 'commentary' } & CommentaryChapter)
  | { state: 'not-covered' }
  /**
   * `unreachable`: no answer at all (offline, blocked); `unreadable`: an answer that is
   * not the chapter asked for. They need different advice, so they are kept apart.
   */
  | { state: 'failed'; reason: 'unreachable' | 'unreadable'; message: string };

type Piece = string | { text?: string; noteId?: number; lineBreak?: boolean };
interface ApiItem { type: string; number?: number; content?: Piece[] }
interface ApiChapter { chapter?: { number?: number; introduction?: string; content?: ApiItem[] } }

function chapterOf(json: unknown, expected: number): { number: number; introduction?: string; content: ApiItem[] } {
  const c = (json as ApiChapter)?.chapter;
  if (!c || !Array.isArray(c.content)) throw new Error('the response has no chapter in it');
  if (c.number !== expected) throw new Error(`the response is for chapter ${c.number}, not ${expected}`);
  return { number: c.number, introduction: c.introduction, content: c.content };
}

/** Text of a verse or note: strings and styled pieces joined; footnote markers dropped. */
const textOf = (pieces: Piece[] = []) =>
  pieces
    .map((p) => (typeof p === 'string' ? p : p.lineBreak ? ' ' : (p.text ?? '')))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const paragraphs = (text: string) => text.split(/\n+/).map((p) => p.trim()).filter(Boolean);

export function readTranslation(json: unknown, chapter: number): TranslationChapter {
  const c = chapterOf(json, chapter);
  const verses: TranslationChapter['verses'] = [];
  const headings: Record<number, string> = {};
  let heading: string | undefined;
  for (const item of c.content) {
    if (item.type === 'heading') heading = textOf(item.content);
    if (item.type === 'verse' && typeof item.number === 'number') {
      if (heading) headings[item.number] = heading;
      heading = undefined;
      verses.push({ number: item.number, text: textOf(item.content) });
    }
  }
  if (!verses.length) throw new Error('the chapter has no verses in it');
  return { verses, headings };
}

export function readCommentary(json: unknown, chapter: number): CommentaryChapter {
  const c = chapterOf(json, chapter);
  const notes = c.content
    .filter((item) => item.type === 'verse' && typeof item.number === 'number')
    .map((item) => ({
      verse: item.number!,
      paragraphs: paragraphs((item.content ?? []).map((p) => (typeof p === 'string' ? p : (p.text ?? ''))).join('\n')),
    }))
    .filter((n) => n.paragraphs.length);
  const introduction = c.introduction ? paragraphs(c.introduction) : undefined;
  if (!notes.length && !introduction?.length) throw new Error('the chapter has no notes in it');
  return { introduction, notes };
}

const cache = new Map<string, Promise<Loaded>>();

/**
 * One chapter of a reference. `fetcher` is injectable for tests. A failure is not
 * cached, so the next attempt tries again; the browser's HTTP cache (a day, as the
 * API asks) keeps re-reads off the network.
 */
export function loadReference(r: Reference, book: string, chapter: number, fetcher: typeof fetch = fetch): Promise<Loaded> {
  const url = chapterUrl(r, book, chapter);
  const hit = fetcher === fetch ? cache.get(url) : undefined;
  if (hit) return hit;
  const p = (async (): Promise<Loaded> => {
    let res: Response;
    try {
      res = await fetcher(url);
    } catch (e) {
      return { state: 'failed', reason: 'unreachable', message: (e as Error).message };
    }
    if (res.status === 404) return { state: 'not-covered' };
    if (!res.ok) return { state: 'failed', reason: 'unreadable', message: `the server answered ${res.status}` };
    try {
      const json: unknown = await res.json();
      return r.kind === 'translation'
        ? { state: 'translation', ...readTranslation(json, chapter) }
        : { state: 'commentary', ...readCommentary(json, chapter) };
    } catch (e) {
      return { state: 'failed', reason: 'unreadable', message: (e as Error).message };
    }
  })();
  if (fetcher === fetch) {
    cache.set(url, p);
    p.then((l) => l.state === 'failed' && cache.delete(url));
  }
  return p;
}

/** The most references open at once. Past four, the columns get too narrow to read. */
export const MAX_REFERENCES = 4;

/** The references last open, so they are there again next time. A preference, kept per device. */
const REFS_KEY = 'workshop:references';
/** Before more than one could be open, the one reference was kept here. */
const OLD_REF_KEY = 'workshop:reference';

/**
 * The references named in storage, in the order they were opened. Ids this version
 * doesn't offer (renamed, withdrawn) are skipped, not an error: it is only a preference,
 * and nothing written is lost.
 */
export function readReferences(saved: string | null, old: string | null): Reference[] {
  let ids: unknown = [];
  try {
    ids = saved === null ? (old ? [old] : []) : JSON.parse(saved);
  } catch {
    ids = [];
  }
  if (!Array.isArray(ids)) return [];
  const found = ids.map((id) => REFERENCES.find((r) => r.id === id)).filter((r): r is Reference => !!r);
  return [...new Set(found)].slice(0, MAX_REFERENCES);
}

export function savedReferences(): Reference[] {
  try {
    return readReferences(localStorage.getItem(REFS_KEY), localStorage.getItem(OLD_REF_KEY));
  } catch {
    return [];
  }
}

export function keepReferences(refs: Reference[]) {
  try {
    localStorage.setItem(REFS_KEY, JSON.stringify(refs.map((r) => r.id)));
    localStorage.removeItem(OLD_REF_KEY);
  } catch {
    // Blocked storage: the choice lasts until the page is closed, which is all we can do.
  }
}
