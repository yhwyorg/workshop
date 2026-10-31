import { describe, expect, it } from 'vitest';
import { BUILT_IN } from '../skins';
import { FONTS, SKIN_PROMPT, contrast, pensOf, skinVariables, validateSkin } from './skin';

const legal = BUILT_IN.daylight as Record<string, unknown>;
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

describe('notebook paper: dotted rules, a solid line every so often, a header box, a second pen', () => {
  const notebook = (paper: Record<string, unknown>, ink: Record<string, unknown> = {}) => {
    const copy = structuredClone(legal) as Record<string, Record<string, unknown>>;
    Object.assign(copy.paper, paper);
    Object.assign(copy.ink, ink);
    return copy;
  };

  it('accepts them, and older skins without them still mean what they did', () => {
    const r = validateSkin(notebook({ rule: 'dotted', every: 8, header: 'date-title' }, { red: '#b5232b' }));
    expect(r.ok && r.skin.paper).toMatchObject({ rule: 'dotted', every: 8, header: 'date-title' });
    expect(r.ok && r.skin.ink.red).toBe('#b5232b');
    const old = validateSkin(legal);
    expect(old.ok && old.skin.paper).toMatchObject({ rule: 'solid', every: 0, header: 'none' });
    // A skin with no second pen colour draws the "red pen" in its accent, as before.
    expect(old.ok && old.skin.ink.red).toBe((legal.ink as Record<string, string>).accent);
  });

  it.each([
    [{ rule: 'dashed;background:url(https://example.com)' }, /paper.rule must be/],
    [{ every: 2.5 }, /paper.every must be a whole number/],
    [{ every: 40 }, /paper.every must be a whole number/],
    [{ header: '<script>' }, /paper.header must be/],
  ])('refuses paper %j', (paper, msg) => {
    expect(errorsOf(notebook(paper)).join(' ')).toMatch(msg);
  });

  it('accepts the colours of a four-colour pen, and offers those pens only when given', () => {
    const r = validateSkin(notebook({}, { red: '#b5232b', black: '#1c1c1e', green: '#1f7a3a' }));
    expect(r.ok && pensOf(r.skin)).toEqual(['pen', 'black', 'red', 'green', 'highlighter']);
    const old = validateSkin(legal);
    expect(old.ok && pensOf(old.skin)).toEqual(['pen', 'red', 'highlighter']);
  });

  it('draws only a pen it knows, and a multi-colour pen only with more than two colours', () => {
    const withPen = (pen: unknown, ink: Record<string, unknown> = {}) => ({ ...notebook({}, ink), pen });
    expect(errorsOf(withPen('<img src=x>')).join(' ')).toMatch(/pen must be one of/);
    expect(errorsOf(withPen('multi-colour')).join(' ')).toMatch(/needs ink.black or ink.green/);
    // Darrell's: blue, black and red.
    const ok = validateSkin(withPen('multi-colour', { black: '#1b1c1e' }));
    expect(ok.ok && ok.skin.pen).toBe('multi-colour');
    expect(ok.ok && pensOf(ok.skin)).toEqual(['pen', 'black', 'red', 'highlighter']);
    const none = validateSkin(legal);
    expect(none.ok && none.skin.pen).toBe('none');
  });

  it('refuses a second pen colour that is not a colour, or can hardly be seen', () => {
    expect(errorsOf(notebook({}, { red: 'red; x: url(https://example.com)' })).join(' ')).toMatch(/ink.red must be a color/);
    expect(errorsOf(notebook({}, { red: '#fafafa' })).join(' ')).toMatch(/ink.red on paper.color/);
  });

  it('draws dotted rules with a solid one every eighth line, as the notebook does', () => {
    const r = validateSkin(notebook({ rule: 'dotted', every: 8, spacing: 32 }));
    if (!r.ok) throw new Error(r.errors.join('; '));
    const rules = decodeURIComponent(skinVariables(r.skin)['--pad-rules']);
    // One tile is eight lines tall: seven dotted, one solid.
    expect(rules).toContain("height='256'");
    expect(rules.match(/stroke-dasharray/g)).toHaveLength(7);
    expect(rules.match(/<line /g)).toHaveLength(8);
  });

  it('draws plain solid rules as it always did when nothing else is asked for', () => {
    const r = validateSkin(legal);
    if (!r.ok) throw new Error(r.errors.join('; '));
    expect(skinVariables(r.skin)['--pad-rules']).toMatch(/^repeating-linear-gradient/);
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
