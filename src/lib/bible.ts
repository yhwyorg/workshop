/**
 * The reader's own Bible: one set of marks and ink on the text, shared by every study,
 * as a printed Bible keeps what was written in it. The user asked for markings and
 * notes beside the verses to "carry through the study sessions".
 *
 * Studies used to keep their own marks and ink on the Bible. They are moved into the
 * Bible whenever the store is read or a study is added, so nothing written before is
 * lost: an old saved copy opened today, or a study written by an older copy of the app,
 * is folded in the same way. The notepad (and its ink) still belongs to its study.
 */
import { LAYOUT } from './layout';
import { bookOf, chapterOf } from './refs';
import type { Bible, Ink, Store, Study } from './studies';

/**
 * Where ink on a surface is kept in a book of the Bible: the text's ink by chapter ("15"),
 * the margin's beside it ("margin:15"). Null for a surface that isn't on the Bible (the
 * notepad). The margin has its own ink so that opening it changes nothing on the text.
 */
export function bibleKey(surface: string): string | null {
  const m = /^(bible|margin):(\d+)$/.exec(surface);
  return !m ? null : m[1] === 'bible' ? m[2] : surface;
}

/** The store with every study's marks and ink on the Bible moved into the one Bible. */
export function intoBible(store: Store): Store {
  const bible: Bible = { ...store.bible };
  // Each book is copied before its first change, so the store passed in is never changed.
  const copied = new Set<string>();
  const own = (book: string) => {
    if (!copied.has(book)) {
      const b = bible[book];
      bible[book] = b ? { marks: { ...b.marks }, ink: { ...b.ink } } : { marks: {}, ink: {} };
      copied.add(book);
    }
    return bible[book];
  };
  const changed = new Map<string, Study>();
  // Oldest first, so on a word both marked, the later study's mark is the one kept.
  const order = [...store.pads].sort((a, b) => a.updated.localeCompare(b.updated));
  // Ink on today's setting first: whichever ink reaches a chapter first decides how it is
  // set for every study, and ink from before paragraphs would set it without them.
  for (const current of [true, false]) {
    for (const study of order) {
      const s = changed.get(study.id) ?? study;
      const book = bookOf(s.passage);
      // A book that can't be read is left where it is, rather than lost.
      if (!book) continue;
      const marks = current && Object.keys(s.marks).length > 0;
      const ink = { ...s.ink };
      let inkMoved = false;
      for (const surface of Object.keys(ink)) {
        const at = bibleKey(surface);
        if (!at || (ink[surface].layout === LAYOUT) !== current) continue;
        const joined = join(bible[book]?.ink[at], ink[surface]);
        if (!joined) continue;
        own(book).ink[at] = joined;
        delete ink[surface];
        inkMoved = true;
      }
      if (!marks && !inkMoved) continue;
      if (marks) Object.assign(own(book).marks, s.marks);
      const next: Study = { ...s, marks: {}, ink };
      if (!Object.keys(ink).length) delete next.ink;
      changed.set(s.id, next);
    }
  }
  // Unchanged, the same store: nothing to save again.
  if (!changed.size) return store;
  return { ...store, pads: store.pads.map((s) => changed.get(s.id) ?? s), bible };
}

/**
 * Ink from two studies of one chapter, as one; or null when they were written on
 * different settings of the text (see Ink.layout), when one of them would float over
 * the wrong words. That ink stays on its study, which shows it as it was written.
 */
function join(into: Ink | undefined, ink: Ink): Ink | null {
  if (!into || !into.strokes.length) return ink;
  if ((into.layout ?? 0) !== (ink.layout ?? 0)) return null;
  // The same study opened twice from a saved copy would otherwise double every stroke.
  const seen = new Set(into.strokes.map((s) => JSON.stringify(s)));
  return { ...into, strokes: [...into.strokes, ...ink.strokes.filter((s) => !seen.has(JSON.stringify(s)))] };
}

/**
 * A study as it should be saved as a copy: with the Bible's marks and ink on its own
 * chapters, so the copy is the whole study. Nothing from other chapters or books: a
 * copy is sent to people, and the rest of the Bible is the reader's own.
 */
export function withBible(study: Study, bible: Bible | undefined, chapters: number[]): Study {
  const book = bookOf(study.passage);
  const b = book ? bible?.[book] : undefined;
  if (!b) return study;
  const marks = { ...study.marks };
  for (const [k, m] of Object.entries(b.marks)) if (chapters.includes(chapterOf(Number(k.split(':')[0])))) marks[k] ??= m;
  const ink = { ...study.ink };
  // Ink left on the study (written on another setting) is the study's own, and kept.
  for (const ch of chapters) {
    for (const surface of [`bible:${ch}`, `margin:${ch}`]) {
      const held = b.ink[bibleKey(surface)!];
      if (held && !ink[surface]) ink[surface] = held;
    }
  }
  return { ...study, marks, ...(Object.keys(ink).length ? { ink } : {}) };
}
