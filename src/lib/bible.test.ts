import { describe, expect, it } from 'vitest';
import { intoBible, withBible } from './bible';
import { STORE_KEY, exportStudy, importStudy, load, newStudy, type Ink, type KV, type Store, type Study } from './studies';

const memory = (init: Record<string, string> = {}): KV => {
  const data = { ...init };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};
const study = (passage: string, updated: string, extra: Partial<Study> = {}): Study => ({
  ...newStudy(passage, ''),
  updated,
  ...extra,
});
const inked = (...pts: number[][]): Ink => ({ width: 560, layout: 2, strokes: pts.map((p) => ({ tool: 'pen', pts: p })) });

describe('one Bible, every study', () => {
  // The user: marks and notes on the Bible should "carry through the study sessions".
  it('moves a study’s marks into the Bible for its book, leaving none behind on the study', () => {
    const s = study('John 15', '2026-10-31T10:00:00Z', { marks: { '15001:4': 'underline' } });
    const out = intoBible({ version: 1, pads: [s] });
    expect(out.bible?.JOH.marks).toEqual({ '15001:4': 'underline' });
    expect(out.pads[0].marks).toEqual({});
  });

  it('keeps every study’s marks on a chapter; on the same word the later study’s mark wins', () => {
    const older = study('John 15', '2026-10-30T10:00:00Z', { marks: { '15001:4': 'underline', '15005:2': 'box' } });
    const newer = study('John 15:1-8', '2026-10-31T10:00:00Z', { marks: { '15001:4': 'circle' } });
    // Newest first, as the app keeps them: order in the list must not decide.
    const out = intoBible({ version: 1, pads: [newer, older] });
    expect(out.bible?.JOH.marks).toEqual({ '15001:4': 'circle', '15005:2': 'box' });
  });

  it('keeps marks on different books apart, though their verse numbers are the same', () => {
    const john = study('John 1', '2026-10-31T10:00:00Z', { marks: { '1001:0': 'underline' } });
    const gen = study('Genesis 1', '2026-10-31T11:00:00Z', { marks: { '1001:0': 'box' } });
    const out = intoBible({ version: 1, pads: [john, gen] });
    expect(out.bible?.JOH.marks).toEqual({ '1001:0': 'underline' });
    expect(out.bible?.GEN.marks).toEqual({ '1001:0': 'box' });
  });

  it('puts the ink of two studies of one chapter together, and the same stroke only once', () => {
    const a = study('John 15', '2026-10-30T10:00:00Z', { ink: { 'bible:15': inked([1, 2, 0.5]) } });
    // A saved copy of the first study, opened again: its stroke is already there.
    const b = study('John 15', '2026-10-31T10:00:00Z', { ink: { 'bible:15': inked([1, 2, 0.5], [9, 9, 0.5]) } });
    const out = intoBible({ version: 1, pads: [a, b] });
    expect(out.bible?.JOH.ink['15'].strokes.map((s) => s.pts)).toEqual([[1, 2, 0.5], [9, 9, 0.5]]);
    expect(out.pads.every((s) => !s.ink?.['bible:15'])).toBe(true);
  });

  it('leaves ink written on another setting of the chapter on its own study, rather than over the wrong words', () => {
    // Ink from before chapters were set in paragraphs (no layout) can't share a page with
    // ink written on the paragraphs: one of them would float over the wrong words.
    const now = study('John 15', '2026-10-31T10:00:00Z', { ink: { 'bible:15': inked([1, 2, 0.5]) } });
    const old = study('John 15', '2026-10-29T10:00:00Z', { ink: { 'bible:15': { width: 560, strokes: [{ tool: 'red', pts: [5, 5, 0.5] }] } } });
    const out = intoBible({ version: 1, pads: [now, old] });
    expect(out.bible?.JOH.ink['15'].layout).toBe(2);
    expect(out.pads.find((s) => s.id === old.id)?.ink?.['bible:15']?.strokes).toHaveLength(1);
  });

  it('leaves the notepad’s ink on the study: notes belong to the study', () => {
    const s = study('John 15', '2026-10-31T10:00:00Z', { ink: { pad: inked([3, 3, 0.5]) } });
    const out = intoBible({ version: 1, pads: [s] });
    expect(out.pads[0].ink?.pad.strokes).toHaveLength(1);
    expect(out.bible?.JOH).toBeUndefined();
  });

  it('keeps the marks of a study whose book can’t be read on that study', () => {
    const s = study('Hezekiah 3', '2026-10-31T10:00:00Z', { marks: { '3001:0': 'box' } });
    expect(intoBible({ version: 1, pads: [s] }).pads[0].marks).toEqual({ '3001:0': 'box' });
  });

  it('changes nothing (the same store, so nothing is saved again) when there is nothing to move', () => {
    const store: Store = { version: 1, pads: [study('John 15', '2026-10-31T10:00:00Z')] };
    expect(intoBible(store)).toBe(store);
  });
});

describe('a saved copy of a study', () => {
  const bible = {
    JOH: {
      marks: { '15001:4': 'underline' as const, '14006:1': 'circle' as const },
      ink: { '15': inked([1, 2, 0.5]), '14': inked([4, 4, 0.5]) },
    },
    GEN: { marks: { '15001:0': 'box' as const }, ink: {} },
  };

  it('carries the Bible’s marks and ink on its own chapters, and no others', () => {
    // A copy is sent to people: John 14 and Genesis are none of their business.
    const s = withBible(study('John 15', '2026-10-31T10:00:00Z'), bible, [15]);
    expect(s.marks).toEqual({ '15001:4': 'underline' });
    expect(Object.keys(s.ink ?? {})).toEqual(['bible:15']);
  });

  it('opened on another device, brings them into that Bible', () => {
    const copy = withBible(study('John 15', '2026-10-31T10:00:00Z'), bible, [15]);
    const opened = intoBible({ version: 1, pads: [importStudy(exportStudy(copy))] });
    expect(opened.bible?.JOH.marks).toEqual({ '15001:4': 'underline' });
    expect(opened.bible?.JOH.ink['15'].strokes).toHaveLength(1);
  });
});

describe('the saved Bible', () => {
  it('round-trips', () => {
    const kv = memory();
    const store = intoBible({ version: 1, pads: [study('John 15', '2026-10-31T10:00:00Z', { marks: { '15001:4': 'box' } })] });
    kv.setItem(STORE_KEY, JSON.stringify(store));
    const r = load(kv);
    expect(r.state === 'ok' && r.store.bible).toEqual(store.bible);
  });

  it.each([
    ['an unknown mark', { JOH: { marks: { '15001:4': 'scribble' }, ink: {} } }],
    ['damaged ink', { JOH: { marks: {}, ink: { '15': { width: 560, strokes: [{ tool: 'pen', pts: [1, 2] }] } } } }],
    ['no marks at all', { JOH: { ink: {} } }],
  ])('is refused as unreadable, never read as empty, with %s', (_, bible) => {
    // Read as empty, the next save would write an empty Bible over the real one.
    expect(load(memory({ [STORE_KEY]: JSON.stringify({ version: 1, pads: [], bible }) })).state).toBe('corrupt');
  });
});
