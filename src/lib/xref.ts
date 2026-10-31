import { BOOKS } from './books';
import { formatPassage, key, type Passage } from './refs';
import { json } from './text';

/**
 * Cross-references: where else Scripture speaks to a verse. OpenBible.info's reader-
 * voted list (CC BY), built into public/xref/<BOOK>.json by scripts/build-xref.mjs,
 * strongest first. It is a list of related passages, not of quotations, and is never
 * presented as one.
 */
export type Xrefs = Record<string, Record<string, string[]>>;

const OLD = new Set(BOOKS.slice(0, 39).map((b) => b.code));
export const testament = (book: string): 'old' | 'new' => (OLD.has(book) ? 'old' : 'new');

const ref = /^([1-3]?[A-Z]{2,3})\.(\d+)\.(\d+)(?:-(?:(\d+)\.)?(\d+))?$/;

/** "PRO.8.22-30", "MAT.5.48-6.1" or "JOH.3.16" as a passage. Throws on anything else. */
export function parseXref(s: string): Passage {
  const m = ref.exec(s);
  if (!m) throw new Error(`unreadable cross-reference "${s}"`);
  const [, book, c, v, c2, v2] = m;
  const start = key(Number(c), Number(v));
  const end = v2 ? key(Number(c2 ?? c), Number(v2)) : start;
  return { book, start, end };
}

/** As a reader writes it: "Isaiah 5:1–7", with an en dash for the range. */
export const xrefLabel = (p: Passage) => formatPassage(p).replace('-', '–');

const cache = new Map<string, Promise<Xrefs>>();

/** A book's cross-references, fetched once per visit. A failure is not kept. */
export function loadXrefs(book: string): Promise<Xrefs> {
  let p = cache.get(book);
  if (!p) {
    p = json<Xrefs>(`xref/${book}.json`);
    p.catch(() => cache.delete(book));
    cache.set(book, p);
  }
  return p;
}

/**
 * A verse's cross-references in two groups, the other testament first: for a New
 * Testament verse, where its roots are in the Old; for an Old, where the New takes it up.
 */
export function crossReferences(x: Xrefs, book: string, chapter: number, verse: number) {
  const all = (x[chapter]?.[verse] ?? []).map(parseXref);
  const here = testament(book);
  const other = here === 'old' ? 'new' : 'old';
  return [
    { testament: other, refs: all.filter((p) => testament(p.book) === other) },
    { testament: here, refs: all.filter((p) => testament(p.book) === here) },
  ];
}
