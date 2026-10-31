import { describe, expect, it } from 'vitest';
import { STORE_KEY, exportPad, importPad, load, newPad, nextMark, save, type KV } from './pads';

const memory = (init: Record<string, string> = {}): KV & { data: Record<string, string> } => {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};

describe('loading saved pads', () => {
  it('starts empty only when nothing was ever saved', () => {
    expect(load(memory()).state).toBe('empty');
  });

  it('round-trips what it saves', () => {
    const kv = memory();
    const pad = newPad('John 15:1-11', 'The vine');
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
    const pad = { ...newPad('Ps 23', 'Shepherd'), notes: { sermonz: 'x' } };
    expect(load(memory({ [STORE_KEY]: JSON.stringify({ version: 1, pads: [pad] }) })).state).toBe('corrupt');
  });

  it('reports storage that cannot be written before anything is typed', () => {
    const kv: KV = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(load(kv)).toEqual({ state: 'unavailable', reason: 'QuotaExceededError' });
  });
});

describe('pad files', () => {
  it('import gives a new id, so a second import adds rather than replaces', () => {
    const pad = newPad('Mark 4:35-41', 'Storm');
    const back = importPad(exportPad(pad));
    expect({ ...back, id: pad.id }).toEqual(pad);
    expect(back.id).not.toBe(pad.id);
  });

  it.each([
    ['not json', /not JSON/],
    ['{"format":"workshop-skin/1"}', /not a workshop pad/],
    ['{"format":"workshop-pad/1","pad":{"id":"x"}}', /missing its id, title/],
  ])('refuses %s', (text, msg) => expect(() => importPad(text)).toThrow(msg));
});

describe('ink', () => {
  it('round-trips through a pad file', () => {
    const pad = { ...newPad('Ps 23', 'Shepherd'), ink: { passage: { width: 740, strokes: [{ tool: 'pen' as const, pts: [10, 12, 0.5, 14, 15, 0.6] }] } } };
    expect(importPad(exportPad(pad)).ink).toEqual(pad.ink);
  });

  it.each([
    ['an unknown tool', { tool: 'laser', pts: [1, 2, 0.5] }],
    ['points not in x,y,pressure triples', { tool: 'pen', pts: [1, 2] }],
    ['a non-number point', { tool: 'pen', pts: [1, 'x', 0.5] }],
  ])('refuses %s rather than drawing garbage', (_, stroke) => {
    const pad = { ...newPad('Ps 23', 'Shepherd'), ink: { passage: { width: 700, strokes: [stroke] } } };
    expect(() => importPad(JSON.stringify({ format: 'workshop-pad/1', pad }))).toThrow(/damaged ink/);
  });
});

describe('word marks', () => {
  it('cycle underline, circle, box, then off', () => {
    expect([undefined, 'underline', 'circle', 'box'].map((m) => nextMark(m as never))).toEqual(['underline', 'circle', 'box', undefined]);
  });
});
