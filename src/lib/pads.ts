/**
 * Pads: one per sermon or study, kept in this browser.
 *
 * There is no server (free static hosting), so pads live in localStorage on the
 * device that made them, with export and import as a file. The shape is versioned
 * and every record carries an id and timestamps, so syncing can be added later
 * without changing what is stored.
 */

export const SHEETS = ['observe', 'questions', 'connections', 'bigIdea', 'outline', 'illustrations', 'application'] as const;
export type Sheet = (typeof SHEETS)[number];

/** Marks a pastor puts on words of the text, cycled by tapping a word. */
export const MARKS = ['underline', 'circle', 'box'] as const;
export type Mark = (typeof MARKS)[number];

/** Pen tools. Colors come from the skin, so ink keeps its meaning (blue writes, red marks) in every look. */
export const TOOLS = ['pen', 'red', 'pencil', 'highlighter'] as const;
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
}

export interface Pad {
  id: string;
  title: string;
  /** The passage as typed and parsed, e.g. "John 15:1-11". */
  passage: string;
  created: string;
  updated: string;
  notes: Partial<Record<Sheet, string>>;
  /** "verseKey:wordIndex" -> mark. */
  marks: Record<string, Mark>;
  /** Handwriting by surface ("passage", "sheet:observe", …). Absent on pads with none. */
  ink?: Record<string, Ink>;
}

export interface Store {
  version: 1;
  pads: Pad[];
}

export const STORE_KEY = 'workshop:store';
export const PAD_FORMAT = 'workshop-pad/1';

/** What reading the saved pads found. "corrupt" must never be treated as "empty". */
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
    const parsed = JSON.parse(raw) as Store;
    if (parsed?.version !== 1 || !Array.isArray(parsed.pads)) throw new Error('not a version 1 store');
    parsed.pads.forEach((p, i) => checkPad(p, `pad ${i + 1}`));
    return { state: 'ok', store: parsed };
  } catch (e) {
    // Never start empty over unreadable data: the next save would overwrite it.
    return { state: 'corrupt', raw, reason: (e as Error).message };
  }
}

export function save(kv: KV, store: Store): void {
  kv.setItem(STORE_KEY, JSON.stringify(store));
}

function checkPad(p: unknown, where: string): asserts p is Pad {
  const x = p as Pad;
  const str = (v: unknown) => typeof v === 'string';
  if (!x || !str(x.id) || !str(x.title) || !str(x.passage) || !str(x.created) || !str(x.updated)) {
    throw new Error(`${where} is missing its id, title, passage or dates`);
  }
  if (typeof x.notes !== 'object' || typeof x.marks !== 'object') throw new Error(`${where} has no notes or marks`);
  for (const [k, v] of Object.entries(x.notes)) {
    if (!SHEETS.includes(k as Sheet) || typeof v !== 'string') throw new Error(`${where} has an unknown sheet "${k}"`);
  }
  for (const v of Object.values(x.marks)) if (!MARKS.includes(v)) throw new Error(`${where} has an unknown mark "${v}"`);
  for (const [surface, ink] of Object.entries(x.ink ?? {})) {
    const ok =
      typeof ink?.width === 'number' &&
      Array.isArray(ink.strokes) &&
      ink.strokes.every(
        (st) => TOOLS.includes(st?.tool) && Array.isArray(st.pts) && st.pts.length % 3 === 0 && st.pts.every((n) => typeof n === 'number' && Number.isFinite(n)),
      );
    if (!ok) throw new Error(`${where} has damaged ink on "${surface}"`);
  }
}

export function newPad(passage: string, title: string, now = new Date()): Pad {
  const stamp = now.toISOString();
  return { id: crypto.randomUUID(), title, passage, created: stamp, updated: stamp, notes: {}, marks: {} };
}

/** A pad as a file someone can keep or send. */
export function exportPad(pad: Pad): string {
  return JSON.stringify({ format: PAD_FORMAT, pad }, null, 2);
}

/**
 * Reads a pad file. It gets a new id, so importing a pad twice (or a colleague's copy
 * of yours) adds a pad rather than silently replacing one.
 */
export function importPad(text: string): Pad {
  let parsed: { format?: unknown; pad?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not a workshop pad (it is not JSON).');
  }
  if (parsed.format !== PAD_FORMAT) throw new Error('This file is not a workshop pad.');
  checkPad(parsed.pad, 'the pad');
  return { ...parsed.pad, id: crypto.randomUUID() };
}

export const nextMark = (m: Mark | undefined): Mark | undefined =>
  m === undefined ? MARKS[0] : MARKS[MARKS.indexOf(m) + 1];
