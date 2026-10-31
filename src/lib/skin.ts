/**
 * Skins: how the workshop looks, as plain data.
 *
 * A skin is a JSON description (colors, paper, ruling, fonts from a fixed set, an
 * optional small embedded texture), never CSS or script. Skins come from strangers,
 * often written by someone's AI, and a pad holds private sermon notes: a skin that
 * could carry CSS could load remote URLs and leak what is on the page, and one that
 * carried script could read it outright. As plain data, the worst a skin can do is
 * look bad. validateSkin() enforces this; nothing reaches the page without passing it.
 */

import { paperTile, svgTooth } from './paper';
import type { Tool } from './studies';

export const SKIN_FORMAT = 'workshop-skin/1';

/** Font choices a skin may name. Each maps to a stack of fonts already on readers' devices. */
export const FONTS = {
  // Literata ships with the site (OFL), so Scripture is set the same on every device.
  book: "'Literata Variable', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
  hand: "'Noteworthy', 'Bradley Hand', 'Segoe Print', 'Comic Sans MS', cursive",
  typewriter: "'American Typewriter', 'Courier Prime', 'Courier New', monospace",
  clean: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  chalk: "'Chalkboard SE', 'Chalkduster', 'Segoe Print', 'Comic Sans MS', cursive",
} as const;
export type FontKey = keyof typeof FONTS;

export interface Skin {
  format: typeof SKIN_FORMAT;
  name: string;
  author?: string;
  description?: string;
  /** Tells the browser to draw its own controls (scrollbars, inputs) dark. */
  dark: boolean;
  desk: { color: string; grain: number };
  paper: {
    color: string;
    /** Ruled lines; "none" for blank paper. */
    lines: string | 'none';
    /** The vertical margin line. */
    margin: string | 'none';
    /** Distance between ruled lines, in pixels. Notes are written on the lines. */
    spacing: number;
    /** 0 = clean, 1 = heavily textured. */
    grain: number;
    /** 0 = new, 1 = coffee-ringed and handled for years. */
    wear: number;
    /** Optional texture laid over the paper: a data: URI of a PNG, JPEG or WebP, at most 200 KB. */
    texture?: string;
    /** "dotted" rules, as many notebooks print them; "solid" otherwise. */
    rule: 'solid' | 'dotted';
    /** A solid rule every this many lines (a notebook's eighth line); 0 for none. */
    every: number;
    /** "date-title": a DATE/NO. and TITLE box at the top of the page, as printed notebooks have. */
    header: 'none' | 'date-title';
  };
  /**
   * notes is the pen's own colour. red is the second pen (the accent when not given);
   * black and green, when given, add those pens: a four-colour pen.
   */
  ink: { text: string; notes: string; accent: string; muted: string; red: string; black?: string; green?: string };
  slip: { color: string; ink: string };
  fonts: { scripture: FontKey; notes: FontKey; ui: FontKey };
}

export type SkinResult = { ok: true; skin: Skin; warnings: string[] } | { ok: false; errors: string[] };

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const TEXTURE = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_TEXTURE = 200_000;

/** Checks an unknown value (parsed from a file someone dropped in) against the skin format. */
export function validateSkin(input: unknown): SkinResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const obj = (v: unknown, path: string): Record<string, unknown> => {
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    errors.push(`${path} must be an object`);
    return {};
  };
  let colorsOk = true;
  const color = (v: unknown, path: string, none = false) => {
    if (none && v === 'none') return 'none';
    if (typeof v === 'string' && HEX.test(v)) return v;
    colorsOk = false;
    errors.push(`${path} must be a color like "#f6e27a"${none ? ' or "none"' : ''}, not ${JSON.stringify(v)}`);
    return '#000000';
  };
  const num = (v: unknown, path: string, min: number, max: number) => {
    if (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max) return v;
    errors.push(`${path} must be a number from ${min} to ${max}, not ${JSON.stringify(v)}`);
    return min;
  };
  const text = (v: unknown, path: string, max: number, optional = false) => {
    if (optional && v === undefined) return undefined;
    if (typeof v === 'string' && v.trim() && v.length <= max) return v.trim();
    errors.push(`${path} must be text of 1-${max} characters`);
    return '';
  };
  // The newer settings are optional, so skins made before them still pass.
  const oneOf = <T extends string>(v: unknown, path: string, allowed: readonly T[], fallback: T): T => {
    if (v === undefined) return fallback;
    if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) return v as T;
    errors.push(`${path} must be one of ${allowed.join(', ')}, not ${JSON.stringify(v)}`);
    return fallback;
  };
  const whole = (v: unknown, path: string, min: number, max: number) => {
    if (v === undefined) return 0;
    if (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max) return v;
    errors.push(`${path} must be a whole number from ${min} to ${max}, not ${JSON.stringify(v)}`);
    return 0;
  };
  const font = (v: unknown, path: string): FontKey => {
    if (typeof v === 'string' && v in FONTS) return v as FontKey;
    errors.push(`${path} must be one of ${Object.keys(FONTS).join(', ')}, not ${JSON.stringify(v)}`);
    return 'book';
  };

  const s = obj(input, 'skin');
  if (s.format !== SKIN_FORMAT) errors.push(`format must be "${SKIN_FORMAT}"`);
  const known = new Set(['format', 'name', 'author', 'description', 'dark', 'desk', 'paper', 'ink', 'slip', 'fonts']);
  for (const k of Object.keys(s)) if (!known.has(k)) warnings.push(`"${k}" is not part of the skin format and was ignored`);

  const desk = obj(s.desk, 'desk');
  const paper = obj(s.paper, 'paper');
  const ink = obj(s.ink, 'ink');
  const slip = obj(s.slip, 'slip');
  const fonts = obj(s.fonts, 'fonts');
  let texture: string | undefined;
  if (paper.texture !== undefined) {
    if (typeof paper.texture !== 'string' || !TEXTURE.test(paper.texture)) {
      // Only an embedded image: a web address here would let a skin call home.
      errors.push('paper.texture must be an embedded image ("data:image/png;base64,…"), not a web address');
    } else if (paper.texture.length > MAX_TEXTURE) {
      errors.push(`paper.texture is ${Math.round(paper.texture.length / 1000)} KB; the limit is ${MAX_TEXTURE / 1000} KB`);
    } else texture = paper.texture;
  }

  const skin: Skin = {
    format: SKIN_FORMAT,
    name: text(s.name, 'name', 60)!,
    author: text(s.author, 'author', 60, true),
    description: text(s.description, 'description', 240, true),
    dark: typeof s.dark === 'boolean' ? s.dark : (errors.push('dark must be true or false'), false),
    desk: { color: color(desk.color, 'desk.color'), grain: num(desk.grain, 'desk.grain', 0, 1) },
    paper: {
      color: color(paper.color, 'paper.color'),
      lines: color(paper.lines, 'paper.lines', true),
      margin: color(paper.margin, 'paper.margin', true),
      spacing: num(paper.spacing, 'paper.spacing', 22, 44),
      grain: num(paper.grain, 'paper.grain', 0, 1),
      wear: num(paper.wear, 'paper.wear', 0, 1),
      ...(texture && { texture }),
      rule: oneOf(paper.rule, 'paper.rule', ['solid', 'dotted'] as const, 'solid'),
      every: whole(paper.every, 'paper.every', 0, 12),
      header: oneOf(paper.header, 'paper.header', ['none', 'date-title'] as const, 'none'),
    },
    ink: {
      text: color(ink.text, 'ink.text'),
      notes: color(ink.notes, 'ink.notes'),
      accent: color(ink.accent, 'ink.accent'),
      muted: color(ink.muted, 'ink.muted'),
      red: ink.red === undefined ? color(ink.accent, 'ink.accent') : color(ink.red, 'ink.red'),
      ...(ink.black !== undefined && { black: color(ink.black, 'ink.black') }),
      ...(ink.green !== undefined && { green: color(ink.green, 'ink.green') }),
    },
    slip: { color: color(slip.color, 'slip.color'), ink: color(slip.ink, 'slip.ink') },
    fonts: { scripture: font(fonts.scripture, 'fonts.scripture'), notes: font(fonts.notes, 'fonts.notes'), ui: font(fonts.ui, 'fonts.ui') },
  };

  // Checked whenever the colors themselves are valid, so a skin with several problems
  // gets them all in one reply, not one round trip to the AI per problem.
  if (colorsOk) {
    // Scripture and notes must stay readable whatever the look: WCAG AA for body text.
    for (const [path, fg, bg] of [
      ['ink.text on paper.color', skin.ink.text, skin.paper.color],
      ['ink.notes on paper.color', skin.ink.notes, skin.paper.color],
      ['slip.ink on slip.color', skin.slip.ink, skin.slip.color],
    ] as const) {
      const r = contrast(fg, bg);
      if (r < 4.5) errors.push(`${path} has contrast ${r.toFixed(2)}:1; at least 4.5:1 is needed so the text stays readable`);
    }
    const m = contrast(skin.ink.muted, skin.paper.color);
    if (m < 3) errors.push(`ink.muted on paper.color has contrast ${m.toFixed(2)}:1; at least 3:1 is needed`);
    // A pen whose ink can hardly be seen on the page is no pen.
    for (const k of ['red', 'black', 'green'] as const) {
      const c = skin.ink[k];
      if (!c) continue;
      const r = contrast(c, skin.paper.color);
      if (r < 3) errors.push(`ink.${k} on paper.color has contrast ${r.toFixed(2)}:1; at least 3:1 is needed`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, skin, warnings };
}

/** WCAG contrast ratio between two hex colors. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const h = hex.length === 4 ? hex.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') : hex;
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** SVG noise as a data URI: paper fibre at `amount` 0-1. Generated here, so skins never ship code. */
function grain(amount: number, seed: number): string {
  if (amount <= 0) return 'none';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' seed='${seed}'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.18  0 0 0 ${(0.22 * amount).toFixed(3)} 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * The ruled lines as a background. Plain solid rules are the gradient they always were;
 * dotted rules, or a solid rule every so many lines, are an SVG tile drawn here (never
 * by the skin): one tile spans the repeat, each line at the bottom of its band, where
 * writing sits on it.
 */
function rules(p: Skin['paper']): string {
  const color = p.lines === 'none' ? 'transparent' : p.lines;
  if (p.lines === 'none' || (p.rule === 'solid' && !p.every)) {
    return `repeating-linear-gradient(to bottom, transparent 0 calc(var(--line) - 1px), ${color} calc(var(--line) - 1px) var(--line))`;
  }
  const n = Math.max(p.every, 1);
  const lines = Array.from({ length: n }, (_, i) => {
    const y = (i + 1) * p.spacing - 0.5;
    const solid = p.rule === 'solid' || (p.every > 0 && (i + 1) % p.every === 0);
    return `<line x1='0' y1='${y}' x2='8' y2='${y}' stroke='${color}' stroke-width='1'${solid ? '' : " stroke-dasharray='1 3'"}/>`;
  });
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='${n * p.spacing}'>${lines.join('')}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** The pens a skin offers, in the toolbar's order: a four-colour pen when it names four. */
export function pensOf(skin: Skin): Tool[] {
  return ['pen', ...(skin.ink.black ? (['black'] as const) : []), 'red', ...(skin.ink.green ? (['green'] as const) : []), 'highlighter'];
}

/** The skin as CSS custom properties. Every value was checked by validateSkin. */
export function skinVariables(skin: Skin): Record<string, string> {
  const p = skin.paper;
  const w = p.wear;
  // Wear: a ring or two of tea, darkened edges. Strength scales from none to plainly old.
  const stains = w > 0
    ? [
        `radial-gradient(circle at 82% 12%, transparent 46px, rgba(120,80,30,${(0.16 * w).toFixed(3)}) 49px, transparent 54px)`,
        `radial-gradient(ellipse at 15% 85%, rgba(120,80,30,${(0.1 * w).toFixed(3)}), transparent 40%)`,
        `radial-gradient(ellipse at center, transparent 60%, rgba(90,60,20,${(0.18 * w).toFixed(3)}) 100%)`,
      ].join(', ')
    : 'none';
  return {
    '--desk': skin.desk.color,
    // Words that sit on the desk (the top bar) take whichever of light or dark ink reads on it.
    '--desk-ink': contrast('#f5efe2', skin.desk.color) >= contrast('#1d1a16', skin.desk.color) ? '#f5efe2' : '#1d1a16',
    '--desk-grain': grain(skin.desk.grain, 7),
    '--paper': p.color,
    '--paper-tooth': svgTooth(p.grain),
    '--paper-wear': stains,
    '--paper-texture': p.texture ? `url("${p.texture}")` : 'none',
    '--rule': p.lines === 'none' ? 'transparent' : p.lines,
    '--margin': p.margin === 'none' ? 'transparent' : p.margin,
    '--line': `${p.spacing}px`,
    '--pad-rules': rules(p),
    '--ink': skin.ink.text,
    '--ink-notes': skin.ink.notes,
    '--accent': skin.ink.accent,
    '--muted': skin.ink.muted,
    '--pen-red': skin.ink.red,
    '--pen-black': skin.ink.black ?? skin.ink.text,
    '--pen-green': skin.ink.green ?? skin.ink.notes,
    '--slip': skin.slip.color,
    '--slip-ink': skin.slip.ink,
    '--font-scripture': FONTS[skin.fonts.scripture],
    '--font-notes': FONTS[skin.fonts.notes],
    '--font-ui': FONTS[skin.fonts.ui],
  };
}

/** skinVariables plus the drawn fibre tile, which needs a canvas and so only exists in a browser. */
export function skinStyle(skin: Skin): Record<string, string> {
  const tile = paperTile(skin.paper.color, skin.paper.grain, skin.dark);
  return { ...skinVariables(skin), '--paper-fibres': tile ? `url("${tile}")` : 'none' };
}

export function applySkin(skin: Skin) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(skinStyle(skin))) root.style.setProperty(k, v);
  root.style.colorScheme = skin.dark ? 'dark' : 'light';
  // Not a variable: the header box changes which elements are drawn how.
  root.dataset.padHeader = skin.paper.header;
}

/** Instructions to paste into an AI so it produces a valid skin. Shown in the Skins panel. */
export const SKIN_PROMPT = `Make a skin for the Sermon Workshop (workshop.yhwh.rest), a Bible study and sermon-building pad.
Reply with JSON only, in exactly this format:

{
  "format": "${SKIN_FORMAT}",
  "name": "Short name",
  "author": "Your name (optional)",
  "description": "One sentence (optional)",
  "dark": false,
  "desk":  { "color": "#hex", "grain": 0.0-1.0 },
  "paper": { "color": "#hex", "lines": "#hex or none", "margin": "#hex or none",
             "spacing": 22-44, "grain": 0.0-1.0, "wear": 0.0-1.0,
             "rule": "solid | dotted (optional)", "every": 0-12 (optional: a solid rule every N lines),
             "header": "none | date-title (optional: a DATE/NO. and TITLE box)" },
  "ink":   { "text": "#hex", "notes": "#hex", "accent": "#hex", "muted": "#hex",
             "red": "#hex (optional)", "black": "#hex (optional)", "green": "#hex (optional)" },
  "slip":  { "color": "#hex", "ink": "#hex" },
  "fonts": { "scripture": "${Object.keys(FONTS).join(' | ')}",
             "notes": "(same choices)", "ui": "(same choices)" }
}

Rules: colors are hex only. ink.text and ink.notes need a contrast of at least 4.5:1 against
paper.color, as does slip.ink against slip.color; ink.muted needs 3:1. "desk" is the surface
everything sits on; "paper" is the legal pad; "slip" is the Bible's page beside it. "wear" adds
age and coffee rings. ink.notes is the pen; ink.red is a second pen; give ink.black and
ink.green too for a four-colour pen. Pen colours need 3:1 against paper.color.
No CSS, no web addresses, no other keys.

The look I want: `;
