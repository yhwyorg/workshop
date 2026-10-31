import { describe, expect, it } from 'vitest';
import { BUILT_IN } from '../skins';
import { FONTS, SKIN_PROMPT, contrast, skinVariables, validateSkin } from './skin';

const legal = BUILT_IN['legal-pad'] as Record<string, unknown>;
const tweak = (path: string, value: unknown) => {
  const copy = structuredClone(legal) as Record<string, Record<string, unknown>>;
  const [a, b] = path.split('.');
  if (b) copy[a][b] = value;
  else (copy as Record<string, unknown>)[a] = value;
  return copy;
};
const errorsOf = (v: unknown) => {
  const r = validateSkin(v);
  return r.ok ? [] : r.errors;
};

describe('built-in skins', () => {
  it.each(Object.keys(BUILT_IN))('%s is valid and readable', (id) => {
    expect(errorsOf(BUILT_IN[id])).toEqual([]);
  });
});

describe('validateSkin refuses what could leak notes or hide text', () => {
  it.each([
    // A remote image would let a skin report who opened which pad.
    ['paper.texture', 'https://example.com/paper.png', /embedded image/],
    ['paper.texture', 'data:image/svg+xml;base64,PHN2Zz4=', /embedded image/],
    // CSS smuggled through a color value.
    ['ink.text', 'red; background: url(https://example.com/x)', /must be a color/],
    ['paper.color', 'url(https://example.com)', /must be a color/],
    ['fonts.notes', "Arial'); @import url(https://example.com", /must be one of/],
    ['paper.spacing', 400, /from 22 to 44/],
    ['format', 'workshop-skin/2', /format must be/],
  ])('%s = %j', (path, value, msg) => {
    expect(errorsOf(tweak(path, value)).join(' ')).toMatch(msg);
  });

  it('reports every problem at once, so fixing a skin takes one trip back to the AI', () => {
    const both = { ...tweak('ink.text', '#f0e080'), paper: { ...(legal.paper as object), texture: 'https://example.com/p.png' } };
    const errs = errorsOf(both).join(' ');
    expect(errs).toMatch(/embedded image/);
    expect(errs).toMatch(/contrast/);
  });

  it('refuses unreadable text', () => {
    // Yellow on yellow: looks like a working skin with an empty pad.
    expect(errorsOf(tweak('ink.text', '#f0e080')).join(' ')).toMatch(/contrast .* at least 4.5:1/);
  });

  it('accepts a small embedded texture and warns about unknown keys', () => {
    const r = validateSkin({ ...tweak('paper.texture', 'data:image/png;base64,iVBORw0KGgo='), css: 'body{}' });
    expect(r.ok).toBe(true);
    expect(r.ok && r.warnings.join(' ')).toMatch(/"css" is not part of the skin format/);
  });

  it('refuses an oversized texture', () => {
    expect(errorsOf(tweak('paper.texture', `data:image/png;base64,${'A'.repeat(250_000)}`)).join(' ')).toMatch(/limit is 200 KB/);
  });
});

describe('skin output', () => {
  it('contrast matches the WCAG reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });

  it('emits every variable the stylesheet uses, with no unchecked text', () => {
    const r = validateSkin(legal);
    if (!r.ok) throw new Error(r.errors.join('; '));
    const vars = skinVariables(r.skin);
    expect(Object.keys(vars)).toContain('--paper');
    expect(Object.values(vars).every((v) => !/[;{}]/.test(v.replace(/data:image\/svg\+xml,[^"]+/, '')))).toBe(true);
  });

  it('tells an AI every font it may choose', () => {
    for (const f of Object.keys(FONTS)) expect(SKIN_PROMPT).toContain(f);
  });
});
