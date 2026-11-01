import { describe, expect, it } from 'vitest';
import {
  STORE_KEY, exportStudy, importStudy, load, newStudy, nextMark, notePageBlank, notePageCount, notePageSurface, notePageText,
  save, withNewNotePage, withNotePageText, withoutNotePage, type Ink, type KV,
} from './studies';

const memory = (init: Record<string, string> = {}): KV & { data: Record<string, string> } => {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};

describe('loading saved studies', () => {
  it('starts empty only when nothing was ever saved', () => {
    expect(load(memory()).state).toBe('empty');
  });

  it('round-trips what it saves', () => {
    const kv = memory();
    const pad = newStudy('John 15:1-11', 'The vine');
    pad.notes.observe = 'Remain, remain, remain.';
    pad.marks['15004:3'] = 'circle';
    save(kv, { version: 1, pads: [pad] });
    const r = load(kv);
    expect(r.state === 'ok' && r.store.pads[0]).toEqual(pad);
  });

  it('refuses to treat unreadable data as empty, so it is never overwritten', () => {
    // The failure this guards against: start empty, save, and a pastor's notes are gone.
    const kv = memory({ [STORE_KEY]: '{"version":1,"pads":[{"id":1}]' });
    const r = load(kv);
    expect(r.state).toBe('corrupt');
    expect(r.state === 'corrupt' && r.raw).toBe(kv.data[STORE_KEY]);
  });

  it('refuses a pad with an unknown sheet rather than dropping it', () => {
    const pad = { ...newStudy('Ps 23', 'Shepherd'), notes: { sermonz: 'x' } };
    expect(load(memory({ [STORE_KEY]: JSON.stringify({ version: 1, pads: [pad] }) })).state).toBe('corrupt');
  });

  it('reports storage that cannot be written before anything is typed', () => {
    const kv: KV = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(load(kv)).toEqual({ state: 'unavailable', reason: 'QuotaExceededError' });
  });
});

describe('pages of notes', () => {
  const inked = (y: number): Ink => ({ width: 460, strokes: [{ tool: 'pen', pts: [1, y, 0.5] }] });

  it('a study from before pages is one page, its notes and ink where they were', () => {
    const s = { ...newStudy('John 15', ''), notes: { page: 'Abide.' }, ink: { pad: inked(1) } };
    expect(notePageCount(s)).toBe(1);
    expect(notePageText(s, 1)).toBe('Abide.');
    expect(notePageSurface(1)).toBe('pad');
  });

  it('keeps each page’s typing to itself', () => {
    const s = withNotePageText(withNewNotePage({ ...newStudy('John 15', ''), notes: { page: 'One' } }), 2, 'Two');
    expect([notePageCount(s), notePageText(s, 1), notePageText(s, 2)]).toEqual([2, 'One', 'Two']);
    expect(s.notePages).toEqual(['Two']);
  });

  it('calls a page blank only with no typing and no ink', () => {
    const s = withNewNotePage(newStudy('John 15', ''));
    expect(notePageBlank(s, 2)).toBe(true);
    expect(notePageBlank(withNotePageText(s, 2, 'x'), 2)).toBe(false);
    expect(notePageBlank({ ...s, ink: { 'pad:2': inked(1) } }, 2)).toBe(false);
    expect(notePageBlank({ ...s, ink: { 'pad:2': { width: 460, strokes: [] } } }, 2)).toBe(true);
  });

  it('removing a page moves the later ones up, their ink with them', () => {
    // Left where it was, page 3's ink would have appeared on nothing, or on the wrong page.
    const s = { ...newStudy('John 15', ''), notePages: ['Two', 'Three', 'Four'], ink: { pad: inked(1), 'pad:2': inked(2), 'pad:3': inked(3), 'pad:4': inked(4) } };
    const out = withoutNotePage(s, 2);
    expect(out.notePages).toEqual(['Three', 'Four']);
    expect(out.ink).toEqual({ pad: inked(1), 'pad:2': inked(3), 'pad:3': inked(4) });
  });

  it('removing the only later page leaves a study of one page, as if it had never had more', () => {
    const s = { ...newStudy('John 15', ''), notePages: ['Two'], ink: { 'pad:2': inked(2) } };
    const out = withoutNotePage(s, 2);
    expect(out.notePages).toBeUndefined();
    expect(out.ink).toBeUndefined();
  });

  it('the first page can’t be removed: it holds the title and date', () => {
    const s = { ...newStudy('John 15', ''), notes: { page: 'One' }, notePages: ['Two'] };
    expect(withoutNotePage(s, 1)).toBe(s);
  });

  it('go with a saved copy', () => {
    const s = { ...newStudy('John 15', ''), notePages: ['Two'], ink: { 'pad:2': inked(2) } };
    const back = importStudy(exportStudy(s));
    expect(back.notePages).toEqual(['Two']);
    expect(back.ink?.['pad:2']).toEqual(inked(2));
  });

  it('a damaged list of pages is refused, not read as none, so it can’t be saved over', () => {
    const s = { ...newStudy('John 15', ''), notePages: ['Two', 3] };
    expect(load(memory({ [STORE_KEY]: JSON.stringify({ version: 1, pads: [s] }) })).state).toBe('corrupt');
  });
});

describe('saved copies', () => {
  it('import gives a new id, so a second import adds rather than replaces', () => {
    const pad = newStudy('Mark 4:35-41', 'Storm');
    const back = importStudy(exportStudy(pad));
    expect({ ...back, id: pad.id }).toEqual(pad);
    expect(back.id).not.toBe(pad.id);
  });

  it.each([
    ['not json', /isn’t JSON/],
    ['{"format":"workshop-skin/1"}', /isn’t a saved study/],
    ['{"format":"workshop-study/1","study":{"id":"x"}}', /missing its id, title/],
  ])('refuses %s', (text, msg) => expect(() => importStudy(text)).toThrow(msg));
});

describe('the rename from "pad"', () => {
  it('still opens copies saved in the first version’s format', () => {
    // Copies made before the rename say "workshop-pad/1" and keep the study under "pad".
    const old = newStudy('Mark 4:35-41', 'Storm');
    const opened = importStudy(JSON.stringify({ format: 'workshop-pad/1', pad: old }));
    expect({ ...opened, id: old.id }).toEqual(old);
  });

  it('still reads studies saved under the first version’s storage key', () => {
    expect(STORE_KEY).toBe('workshop:store');
  });
});

describe('ink', () => {
  it('round-trips through a pad file', () => {
    const pad = { ...newStudy('Ps 23', 'Shepherd'), ink: { passage: { width: 740, strokes: [{ tool: 'pen' as const, pts: [10, 12, 0.5, 14, 15, 0.6] }] } } };
    expect(importStudy(exportStudy(pad)).ink).toEqual(pad.ink);
  });

  it.each([
    ['an unknown tool', { tool: 'laser', pts: [1, 2, 0.5] }],
    ['points not in x,y,pressure triples', { tool: 'pen', pts: [1, 2] }],
    ['a non-number point', { tool: 'pen', pts: [1, 'x', 0.5] }],
  ])('refuses %s rather than drawing garbage', (_, stroke) => {
    const pad = { ...newStudy('Ps 23', 'Shepherd'), ink: { passage: { width: 700, strokes: [stroke] } } };
    expect(() => importStudy(JSON.stringify({ format: 'workshop-study/1', study: pad }))).toThrow(/damaged ink/);
  });
});

describe('word marks', () => {
  it('cycle underline, circle, box, then off', () => {
    expect([undefined, 'underline', 'circle', 'box'].map((m) => nextMark(m as never))).toEqual(['underline', 'circle', 'box', undefined]);
  });
});
