// Records how the World English Bible is set on the page: where its paragraphs,
// poetry lines, headings and psalm titles begin, and which words are Jesus' own. Read
// from eBible.org's USFM edition; written to public/text/en/layout/<CODE>.json.
//
//   curl -L -o engwebp_usfm.zip https://eBible.org/Scriptures/engwebp_usfm.zip
//   unzip engwebp_usfm.zip -d engwebp_usfm
//   node scripts/build-layout.mjs engwebp_usfm
//
// The words themselves still come from the VPL text (public/text/en/<CODE>.json).
// Layout positions are word indexes into those verses, so the USFM's words are
// checked against them verse by verse: a mismatch would put a paragraph break, a
// mark or a red letter on the wrong word, and it stops the build.
//
// Output, per chapter: { blocks, wj }
//   blocks  [style, [[verse, fromWord, toWord], ...]]   toWord exclusive
//           ["h", kind, text]                            a heading, part of no verse
//   style   p | m | nb | pi | q1 | q2 | q3 | d | qa | b
//   wj      { verse: [[fromWord, toWord], ...] }         the words of Jesus
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [, , dir] = process.argv;
if (!dir) {
  console.error('usage: node scripts/build-layout.mjs <folder of engwebp USFM files>');
  process.exit(1);
}

/** USFM paragraph markers, by the style the page sets them in. */
const STYLES = {
  p: 'p', pmo: 'p', pm: 'p', pc: 'p', pr: 'p', mi: 'm', m: 'm', nb: 'nb', pi: 'pi', pi1: 'pi', pi2: 'pi',
  q: 'q1', q1: 'q1', q2: 'q2', q3: 'q3', q4: 'q3', qm1: 'q1', qm2: 'q2', qr: 'q2', qc: 'q1',
  li: 'pi', li1: 'pi', li2: 'q2', li3: 'q3', d: 'd', qa: 'qa', b: 'b',
};
/** Line markers whose text is a heading (kept) or book furniture (dropped). */
const LINES = {
  s: 's', s1: 's', s2: 's', ms: 'ms', ms1: 'ms', mr: 'ms',
  // Who is speaking, in the Song of Songs ("Beloved", "Lover"): a line of its own.
  sp: 'sp',
  r: null, sr: null, cl: null, mt: null, mt1: null, mt2: null, mt3: null, h: null, toc1: null, toc2: null, toc3: null,
  id: null, ide: null, is: null, ip: null, imt: null, rem: null, usfm: null,
};
/** Character styles: their words are read, the marker itself is not. */
const CHARS = /^(w|add|nd|qs|it|bd|em|sc|tl|k|qt|sls|bk|pn|ord|sig|no)$/;
const USFM_TO_OURS = { SNG: 'SOL', EZK: 'EZE', JOL: 'JOE', NAM: 'NAH', MRK: 'MAR', JHN: 'JOH', PHP: 'PHI', JAS: 'JAM', '1JN': '1JO', '2JN': '2JO', '3JN': '3JO' };

const vplDir = new URL('../public/text/en/', import.meta.url);
const out = new URL('layout/', vplDir);
mkdirSync(out, { recursive: true });
const words = (s) => s.split(/\s+/).filter(Boolean);
/** Whether a character offset falls inside a word rather than between two. */
const inside = (s, off) => off > 0 && off < s.length && /\S/.test(s[off - 1]) && /\S/.test(s[off]);
/**
 * The word index at a character offset. Inside a word, a start rounds back to that
 * word and an end forward past it: the words of Jesus begin and end against quotation
 * marks ("“\wj Who"), and the word holding the mark is his.
 */
function wordAt(s, off, side) {
  const n = words(s.slice(0, off)).length;
  return inside(s, off) && side === 'start' ? n - 1 : n;
}

let mismatches = 0;
let midWord = 0;
let books = 0;
const unknown = new Map();

for (const f of readdirSync(dir).filter((f) => f.endsWith('.usfm'))) {
  const raw = readFileSync(join(dir, f), 'utf8').replace(/\r/g, '');
  const id = /^\\id (\w{3})/.exec(raw)?.[1];
  const code = USFM_TO_OURS[id] ?? id;
  let vpl;
  try {
    vpl = JSON.parse(readFileSync(new URL(`${code}.json`, vplDir), 'utf8'));
  } catch {
    continue; // front matter, glossary, deuterocanon: not in this Bible
  }
  books++;

  const chapters = [];
  let ch = null; // { text: {verse: string}, marks: [...] } where marks are in reading order
  let v = 0;
  let style = 'p';
  const at = () => {
    const verse = v || 1; // a psalm's title, before verse 1, is verse 1's in the VPL
    return { verse, off: (ch.text[verse] ?? '').length };
  };
  // Nested character markers carry a "+" (\+w Selah\+w* inside \qs).
  const pieces = raw.split(/(\\\+?[a-z]+[0-9]*\*?)/);
  for (let i = 0; i < pieces.length; i++) {
    const t = pieces[i];
    const m = /^\\\+?([a-z]+[0-9]*)(\*?)$/.exec(t);
    if (!m) {
      if (!ch) continue;
      // Word attributes (\w word|strong="H1234"\w*) are not read.
      const text = t.replace(/\|(?:\s*[\w-]+="[^"]*")+/g, '').replace(/\n/g, ' ');
      if (!text) continue;
      const verse = v || 1;
      if (!/\S/.test(text) && !ch.text[verse]) continue;
      ch.text[verse] = (ch.text[verse] ?? '') + text;
      continue;
    }
    const [, name, end] = m;
    // The space after an opening marker separates it from its text; it is not text.
    if (!end && typeof pieces[i + 1] === 'string') pieces[i + 1] = pieces[i + 1].replace(/^ /, '');
    if (name === 'c') {
      const n = /^\s*(\d+)/.exec(pieces[i + 1]);
      pieces[i + 1] = pieces[i + 1].slice(n[0].length);
      ch = { text: {}, marks: [] };
      chapters[Number(n[1]) - 1] = ch;
      v = 0;
      ch.marks.push({ kind: 'block', style, ...at() });
    } else if (name === 'v') {
      const n = /^\s*(\d+)\S*\s?/.exec(pieces[i + 1]);
      pieces[i + 1] = pieces[i + 1].slice(n[0].length);
      v = Number(n[1]);
    } else if (name === 'qs' && !end && ch) {
      // "Selah" is set apart from what precedes it; the VPL text has a space there
      // even where the USFM runs it on ("Lord—\qs Selah").
      const verse = v || 1;
      if (/\S$/.test(ch.text[verse] ?? '')) ch.text[verse] += ' ';
    } else if (name === 'wj') {
      if (ch) ch.marks.push({ kind: end ? 'wj-end' : 'wj', ...at() });
    } else if (name === 'f' || name === 'x' || name === 'fe') {
      while (i < pieces.length && pieces[i] !== `\\${name}*`) i++;
    } else if (name in LINES) {
      const rest = pieces[i + 1] ?? '';
      const line = rest.split('\n')[0];
      pieces[i + 1] = rest.slice(line.length);
      const kind = LINES[name];
      // A speaker named in the middle of a verse is among that verse's words in the VPL
      // text ("Friends We will be glad", Song 1:4), though one at a verse's start is
      // not; so mid-verse it is counted as words, set on a line of its own.
      // Ahead of a verse number, it opens the next verse instead: a heading.
      let opensVerse = false;
      for (let j = i + 2; j < pieces.length; j++) {
        const mk = /^\\+?([a-z]+[0-9]*)\*?$/.exec(pieces[j]);
        if (!mk) {
          if (/\S/.test(pieces[j])) break;
          continue;
        }
        if (mk[1] === 'v') opensVerse = true;
        if (mk[1] === 'v' || !(mk[1] in STYLES)) break;
      }
      if (name === 'sp' && ch && v && !opensVerse && /\S/.test(ch.text[v] ?? '')) {
        const label = line.replace(/\|(?:\s*[\w-]+="[^"]*")+/g, '').replace(/\\+?[a-z]+[0-9]*\*?/g, '').trim();
        ch.marks.push({ kind: 'block', style: 'sp', ...at() });
        ch.text[v] += ` ${label} `;
        ch.marks.push({ kind: 'block', style, ...at() });
        continue;
      }
      if (kind && ch) {
        const text = line.replace(/\|(?:\s*[\w-]+="[^"]*")+/g, '').replace(/\\[a-z]+[0-9]*\*?/g, '').replace(/\s+/g, ' ').trim();
        ch.marks.push({ kind: 'heading', heading: kind, text, ...at() });
      }
    } else if (name in STYLES) {
      if (!ch) continue;
      if (STYLES[name] === 'b') {
        ch.marks.push({ kind: 'blank', ...at() });
        continue;
      }
      style = STYLES[name];
      ch.marks.push({ kind: 'block', style, ...at() });
    } else if (!CHARS.test(name)) {
      unknown.set(name, (unknown.get(name) ?? 0) + 1);
    }
  }

  const book = chapters.map((c, ci) => {
    // Check the words first: every position below counts words of the VPL text.
    for (const [verse, s] of Object.entries(c.text)) {
      const want = words(vpl[ci]?.[Number(verse) - 1] ?? '');
      const got = words(s);
      if (want.join(' ') !== got.join(' ')) {
        mismatches++;
        if (mismatches <= 12) {
          const k = Math.max(0, want.findIndex((w, j) => w !== got[j]));
          console.error(`${code} ${ci + 1}:${verse} differs at word ${k}: VPL "${want.slice(k, k + 4).join(' ')}" / USFM "${got.slice(k, k + 4).join(' ')}"`);
        }
      }
    }
    const total = (verse) => words(c.text[verse] ?? '').length;
    // A paragraph or line break inside a word is an error: half a word would move.
    const word = (pos, side = 'start') => {
      const s = c.text[pos.verse] ?? '';
      if (pos.kind !== 'wj' && pos.kind !== 'wj-end' && inside(s, pos.off)) {
        midWord++;
        if (midWord <= 12) console.error(`${code} ${ci + 1}:${pos.verse} has a break inside a word at character ${pos.off}`);
      }
      return wordAt(s, pos.off, side);
    };
    const verses = Object.keys(c.text).map(Number).sort((a, b) => a - b);
    const lastVerse = verses.at(-1);
    const blocks = [];
    const wj = {};
    let open = null;
    let wjFrom = null;
    const close = (to) => {
      if (!open) return;
      const parts = [];
      for (const verse of verses) {
        if (verse < open.verse || verse > to.verse) continue;
        const from = verse === open.verse ? word(open) : 0;
        const upto = verse === to.verse ? word(to) : total(verse);
        if (upto > from) parts.push([verse, from, upto]);
      }
      if (parts.length) blocks.push([open.style, parts]);
      open = null;
    };
    const end = { verse: lastVerse, off: (c.text[lastVerse] ?? '').length };
    for (const mk of c.marks) {
      if (mk.kind === 'block') {
        close(mk);
        open = mk;
      } else if (mk.kind === 'heading' || mk.kind === 'blank') {
        const style = open?.style ?? 'p';
        close(mk);
        blocks.push(mk.kind === 'heading' ? ['h', mk.heading, mk.text] : ['b', []]);
        open = { style, verse: mk.verse, off: mk.off };
      } else if (mk.kind === 'wj') {
        wjFrom = mk;
      } else if (mk.kind === 'wj-end' && wjFrom) {
        for (const verse of verses) {
          if (verse < wjFrom.verse || verse > mk.verse) continue;
          const from = verse === wjFrom.verse ? word(wjFrom) : 0;
          const to = verse === mk.verse ? word(mk, 'end') : total(verse);
          if (to > from) (wj[verse] ??= []).push([from, to]);
        }
        wjFrom = null;
      }
    }
    close(end);
    return { blocks, wj };
  });
  writeFileSync(new URL(`${code}.json`, out), JSON.stringify(book));
}

if (unknown.size) console.log('markers not set (their text is read as running text):', Object.fromEntries(unknown));
const problems = [];
if (books !== 66) problems.push(`${books} books laid out, expected 66`);
if (mismatches) problems.push(`${mismatches} verses whose words differ from the VPL text`);
if (midWord) problems.push(`${midWord} breaks inside a word`);
if (problems.length) {
  console.error(`${problems.join('; ')}: layout not trusted`);
  process.exit(1);
}
console.log(`laid out ${books} books; every verse's words match the VPL text`);
