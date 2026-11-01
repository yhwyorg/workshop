/**
 * Studies: one per passage being worked on, kept in this browser.
 *
 * There is no server (free static hosting), so studies live in localStorage on the
 * device that made them, with a saved copy as a file. The shape is versioned and
 * every record carries an id and timestamps, so syncing can be added later without
 * changing what is stored.
 *
 * Studies were first called "pads"; the stored key and the old file format are
 * still read, so nothing made under the old name is lost.
 */

/**
 * Where notes are written. "page" is the legal pad itself. The rest are the
 * headed sheets of the first version; they are kept, and shown when they hold
 * writing, so nothing written there disappears.
 */
export const SHEETS = ['page', 'observe', 'questions', 'connections', 'bigIdea', 'outline', 'illustrations', 'application'] as const;
export type Sheet = (typeof SHEETS)[number];

/** Marks a pastor puts on words of the text, cycled by tapping a word. */
export const MARKS = ['underline', 'circle', 'box'] as const;
export type Mark = (typeof MARKS)[number];

/** Pen tools. Colors come from the skin, so ink keeps its meaning (blue writes, red marks) in every look. */
// "black" and "green" are the other colours of a multi-colour pen (Darrell's has black).
export const TOOLS = ['pen', 'black', 'red', 'green', 'pencil', 'highlighter'] as const;
export type Tool = (typeof TOOLS)[number];

export interface Stroke {
  tool: Tool;
  /** x, y, pressure, x, y, pressure, … in CSS pixels from the surface's top left. */
  pts: number[];
}

/** Ink on one surface: the passage slip, or one sheet. */
export interface Ink {
  /**
   * Surface width when the ink was written. Text reflows when the width changes (an
   * iPad turned sideways), so ink only lines up with the words at this width; the
   * page says so rather than leaving ink floating over the wrong words unexplained.
   */
  width: number;
  strokes: Stroke[];
  /**
   * How the Bible's text was set when this ink was written on it (see layout.ts); absent
   * for ink from before chapters were set in paragraphs, which keeps the old setting.
   */
  layout?: number;
}

export interface Study {
  id: string;
  title: string;
  /** The passage as typed and parsed, e.g. "John 15:1-11". */
  passage: string;
  created: string;
  updated: string;
  notes: Partial<Record<Sheet, string>>;
  /** "verseKey:wordIndex" -> mark. */
  marks: Record<string, Mark>;
  /** Handwriting by surface ("pad", "pad:2", "bible:15", …). Absent on studies with none. */
  ink?: Record<string, Ink>;
  /**
   * The typing on the notes' second page onward. Page one stays in notes.page and its ink
   * in "pad", where it has always been, so a study from before pages needs nothing moved.
   * Absent on a study of one page.
   */
  notePages?: string[];
}

/**
 * One book of the reader's own Bible: the marks and ink on its text, shared by every
 * study of it, as a printed Bible keeps what was written in it (see bible.ts).
 */
export interface BookMarks {
  /** "verseKey:wordIndex" -> mark, as on a study. */
  marks: Record<string, Mark>;
  /** Ink by chapter number ("15"), and in that chapter's margin ("margin:15"). */
  ink: Record<string, Ink>;
}
/** By book code ("JOH"). */
export type Bible = Record<string, BookMarks>;

export interface Store {
  version: 1;
  /** Named "pads" when this was written; renaming it would orphan every saved study. */
  pads: Study[];
  /**
   * Absent until something is marked. Added to version 1 rather than bumping it: a
   * copy of the app from before keeps it when saving (it saves the store it read
   * spread), where a new version number would show that copy a "damaged" store.
   */
  bible?: Bible;
}

export const STORE_KEY = 'workshop:store';
export const STUDY_FORMAT = 'workshop-study/1';
/** The first version's file format, still accepted when opening a saved copy. */
const OLD_FORMAT = 'workshop-pad/1';

/** What reading the saved studies found. "corrupt" must never be treated as "empty". */
export type Loaded =
  | { state: 'ok'; store: Store }
  | { state: 'empty'; store: Store }
  | { state: 'corrupt'; raw: string; reason: string }
  | { state: 'unavailable'; reason: string };

/** Minimal storage interface, so tests can stand in for localStorage. */
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export function load(kv: KV): Loaded {
  let raw: string | null;
  try {
    raw = kv.getItem(STORE_KEY);
    // A write that fails here means saving would fail too: say so before anything is typed.
    kv.setItem(`${STORE_KEY}:probe`, '1');
  } catch (e) {
    return { state: 'unavailable', reason: (e as Error).message };
  }
  if (raw === null) return { state: 'empty', store: { version: 1, pads: [] } };
  try {
    const parsed: unknown = JSON.parse(raw);
    checkStore(parsed);
    return { state: 'ok', store: parsed };
  } catch (e) {
    // Never start empty over unreadable data: the next save would overwrite it.
    return { state: 'corrupt', raw, reason: (e as Error).message };
  }
}

export function save(kv: KV, store: Store): void {
  kv.setItem(STORE_KEY, JSON.stringify(store));
}

/** Throws, naming what is wrong, unless this is a store every part of which can be read. */
export function checkStore(x: unknown): asserts x is Store {
  const store = x as Store;
  if (store?.version !== 1 || !Array.isArray(store.pads)) throw new Error('not a version 1 store');
  store.pads.forEach((p, i) => checkStudy(p, `study ${i + 1}`));
  for (const [book, b] of Object.entries(store.bible ?? {})) checkMarked(b, `the Bible's ${book}`);
}

function checkStudy(p: unknown, where: string): asserts p is Study {
  const x = p as Study;
  const str = (v: unknown) => typeof v === 'string';
  if (!x || !str(x.id) || !str(x.title) || !str(x.passage) || !str(x.created) || !str(x.updated)) {
    throw new Error(`${where} is missing its id, title, passage or dates`);
  }
  if (typeof x.notes !== 'object') throw new Error(`${where} has no notes or marks`);
  for (const [k, v] of Object.entries(x.notes)) {
    if (!SHEETS.includes(k as Sheet) || typeof v !== 'string') throw new Error(`${where} has an unknown sheet "${k}"`);
  }
  if (x.notePages !== undefined && !(Array.isArray(x.notePages) && x.notePages.every((t) => typeof t === 'string'))) {
    throw new Error(`${where} has damaged pages of notes`);
  }
  checkMarked({ marks: x.marks, ink: x.ink ?? {} }, where);
}

/** Marks and ink, on a study or in the Bible. */
function checkMarked(x: BookMarks, where: string) {
  if (!x || typeof x.marks !== 'object' || x.marks === null || typeof x.ink !== 'object' || x.ink === null) {
    throw new Error(`${where} has no notes or marks`);
  }
  for (const v of Object.values(x.marks)) if (!MARKS.includes(v)) throw new Error(`${where} has an unknown mark "${v}"`);
  for (const [surface, ink] of Object.entries(x.ink)) {
    const ok =
      typeof ink?.width === 'number' &&
      // A setting this version doesn't know would put the ink over the wrong words.
      (ink.layout === undefined || ink.layout === 2) &&
      Array.isArray(ink.strokes) &&
      ink.strokes.every(
        (st) => TOOLS.includes(st?.tool) && Array.isArray(st.pts) && st.pts.length % 3 === 0 && st.pts.every((n) => typeof n === 'number' && Number.isFinite(n)),
      );
    if (!ok) throw new Error(`${where} has damaged ink on "${surface}"`);
  }
}

export function newStudy(passage: string, title: string, now = new Date()): Study {
  const stamp = now.toISOString();
  return { id: crypto.randomUUID(), title, passage, created: stamp, updated: stamp, notes: {}, marks: {} };
}

/** A study as a file someone can keep or send. */
export function exportStudy(study: Study): string {
  return JSON.stringify({ format: STUDY_FORMAT, study }, null, 2);
}

/**
 * Reads a saved copy. It gets a new id, so opening one twice (or a colleague's copy
 * of yours) adds a study rather than silently replacing one.
 */
export function importStudy(text: string): Study {
  let parsed: { format?: unknown; study?: unknown; pad?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file isn’t a saved study (it isn’t JSON).');
  }
  const study = parsed.format === STUDY_FORMAT ? parsed.study : parsed.format === OLD_FORMAT ? parsed.pad : undefined;
  if (study === undefined) throw new Error('This file isn’t a saved study.');
  checkStudy(study, 'the study');
  return { ...study, id: crypto.randomUUID() };
}

/** How many pages of notes a study has. */
export const notePageCount = (s: Study) => 1 + (s.notePages?.length ?? 0);

/** The surface holding the ink on a page of notes (counted from 1). */
export const notePageSurface = (page: number) => (page === 1 ? 'pad' : `pad:${page}`);

/** The typing on a page of notes. */
export const notePageText = (s: Study, page: number) => (page === 1 ? s.notes.page : s.notePages?.[page - 2]) ?? '';

export function withNotePageText(s: Study, page: number, text: string): Study {
  if (page === 1) return { ...s, notes: { ...s.notes, page: text } };
  const notePages = [...(s.notePages ?? [])];
  notePages[page - 2] = text;
  return { ...s, notePages };
}

/** True when a page holds no typing and no ink. */
export const notePageBlank = (s: Study, page: number) => !notePageText(s, page).trim() && !s.ink?.[notePageSurface(page)]?.strokes.length;

export const withNewNotePage = (s: Study): Study => ({ ...s, notePages: [...(s.notePages ?? []), ''] });

/**
 * A study without one of its later pages. Those after it move up, their ink with them, or
 * each would be left with the writing of the page after it. The first page stays: it holds
 * the study's title and date.
 */
export function withoutNotePage(s: Study, page: number): Study {
  if (page < 2 || page > notePageCount(s)) return s;
  const { notePages: all = [], ...rest } = s;
  const notePages = all.filter((_, i) => i !== page - 2);
  const ink = { ...s.ink };
  delete ink[notePageSurface(page)];
  for (let p = page + 1; p <= all.length + 1; p++) {
    const moved = ink[notePageSurface(p)];
    delete ink[notePageSurface(p)];
    if (moved) ink[notePageSurface(p - 1)] = moved;
  }
  const out: Study = notePages.length ? { ...rest, notePages } : rest;
  if (Object.keys(ink).length) out.ink = ink;
  else delete out.ink;
  return out;
}

export const nextMark = (m: Mark | undefined): Mark | undefined =>
  m === undefined ? MARKS[0] : MARKS[MARKS.indexOf(m) + 1];
