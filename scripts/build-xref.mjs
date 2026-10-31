// Converts OpenBible.info's cross-references into one JSON file per book,
// public/xref/<CODE>.json: { "<chapter>": { "<verse>": ["JOH.15.1-15.2", ...] } },
// the strongest first. They are fetched a book at a time when a verse is opened.
//
//   curl -L -o cross-references.zip https://a.openbible.info/data/cross-references.zip
//   unzip cross-references.zip
//   node scripts/build-xref.mjs cross_references.txt
//
// The data is CC BY (openbible.info); the credit is shown wherever it is used. It is
// a reader-voted list of related passages, not a list of quotations, and is labelled
// as such in the page.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const [, , input] = process.argv;
if (!input) {
  console.error('usage: node scripts/build-xref.mjs <path to cross_references.txt>');
  process.exit(1);
}

/** Per verse, the most to keep; past this the list is noise for a sermon. */
const KEEP = 12;

// OpenBible's OSIS book ids, in canonical order, beside ours (eBible's). Paired by
// position; every id is asserted to occur, so a misspelt one stops the build rather
// than leaving a book with no references.
const OSIS = 'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev'.split(' ');
const OURS = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SOL ISA JER LAM EZE DAN HOS JOE AMO OBA JON MIC NAH HAB ZEP HAG ZEC MAL MAT MAR LUK JOH ACT ROM 1CO 2CO GAL EPH PHI COL 1TH 2TH 1TI 2TI TIT PHM HEB JAM 1PE 2PE 1JO 2JO 3JO JUD REV'.split(' ');
if (OSIS.length !== 66 || OURS.length !== 66) throw new Error('book lists must have 66 entries');
const CODE = new Map(OSIS.map((o, i) => [o, OURS[i]]));

// Verse counts, to drop references to verses this Bible doesn't have (versification
// differs between Bibles; a reference to a missing verse would open nothing).
const lengths = JSON.parse(readFileSync(new URL('../public/text/en/books.json', import.meta.url), 'utf8'));
const exists = (book, c, v) => (lengths[book]?.[c - 1] ?? 0) >= v;

const point = /^(\w+)\.(\d+)\.(\d+)$/;
function parse(ref) {
  const [a, b] = ref.split('-');
  const m = point.exec(a);
  if (!m) throw new Error(`unreadable reference "${ref}"`);
  const book = CODE.get(m[1]);
  if (!book) throw new Error(`unknown book "${m[1]}" in "${ref}"`);
  const start = { book, c: Number(m[2]), v: Number(m[3]) };
  let end = start;
  if (b) {
    const n = point.exec(b);
    if (!n) throw new Error(`unreadable reference "${ref}"`);
    end = { book: CODE.get(n[1]), c: Number(n[2]), v: Number(n[3]) };
  }
  return { start, end };
}

const seen = new Set();
const out = new Map(OURS.map((code) => [code, {}]));
const all = new Map();
let dropped = 0;
let lines = 0;
for (const raw of readFileSync(input, 'utf8').split(/\r?\n/).slice(1)) {
  if (!raw.trim()) continue;
  const [from, to, votes] = raw.split('\t');
  lines++;
  const f = parse(from).start;
  const t = parse(to);
  seen.add(from.split('.')[0]);
  seen.add(to.split('.')[0]);
  if (Number(votes) <= 0) continue;
  // A range that runs into another book is kept to its first book's part only.
  const end = t.end.book === t.start.book ? t.end : t.start;
  if (!exists(f.book, f.c, f.v) || !exists(t.start.book, t.start.c, t.start.v) || !exists(end.book, end.c, end.v)) {
    dropped++;
    continue;
  }
  const key = `${f.book} ${f.c} ${f.v}`;
  const ref = `${t.start.book}.${t.start.c}.${t.start.v}` + (end === t.start ? '' : end.c === t.start.c ? `-${end.v}` : `-${end.c}.${end.v}`);
  (all.get(key) ?? all.set(key, []).get(key)).push([Number(votes), ref]);
}

const missing = OSIS.filter((o) => !seen.has(o));
if (missing.length) {
  console.error(`no references at all for: ${missing.join(' ')}`);
  process.exit(1);
}

let kept = 0;
for (const [key, refs] of all) {
  const [book, c, v] = key.split(' ');
  const top = refs.sort((a, b) => b[0] - a[0]).slice(0, KEEP).map(([, r]) => r);
  ((out.get(book)[c] ??= {})[v] = top);
  kept += top.length;
}

const dir = new URL('../public/xref/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const [code, chapters] of out) writeFileSync(new URL(`${code}.json`, dir), JSON.stringify(chapters));
console.log(`${lines} references read; ${kept} kept (top ${KEEP} per verse, votes > 0); ${dropped} dropped as not in this Bible`);
