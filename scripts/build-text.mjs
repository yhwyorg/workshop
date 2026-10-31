// Converts the eBible.org World English Bible VPL file into one JSON file per book,
// public/text/en/<CODE>.json ([chapter][verse] -> text), plus books.json listing
// each book's verse counts. Books are fetched one at a time when a pad opens a
// passage, so the whole Bible never loads at once.
//
//   curl -L -o engwebp_vpl.zip https://eBible.org/Scriptures/engwebp_vpl.zip
//   unzip engwebp_vpl.zip -d engwebp
//   node scripts/build-text.mjs engwebp/engwebp_vpl.txt
//
// The WEB is public domain; eBible.org asks that a modified text not be called the
// World English Bible, so this only selects and re-keys verses, never edits them.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const [, , input] = process.argv;
if (!input) {
  console.error('usage: node scripts/build-text.mjs <path to engwebp_vpl.txt>');
  process.exit(1);
}

// eBible's VPL book codes, in canonical order, with each book's chapter count. The
// counts are asserted: a code typed wrong (eBible uses MAR/JOH, not USFM's MRK/JHN)
// silently matches nothing, and that must stop the build, not ship an empty book.
const BOOKS = [
  ['GEN', 50], ['EXO', 40], ['LEV', 27], ['NUM', 36], ['DEU', 34], ['JOS', 24], ['JDG', 21], ['RUT', 4],
  ['1SA', 31], ['2SA', 24], ['1KI', 22], ['2KI', 25], ['1CH', 29], ['2CH', 36], ['EZR', 10], ['NEH', 13],
  ['EST', 10], ['JOB', 42], ['PSA', 150], ['PRO', 31], ['ECC', 12], ['SOL', 8], ['ISA', 66], ['JER', 52],
  ['LAM', 5], ['EZE', 48], ['DAN', 12], ['HOS', 14], ['JOE', 3], ['AMO', 9], ['OBA', 1], ['JON', 4],
  ['MIC', 7], ['NAH', 3], ['HAB', 3], ['ZEP', 3], ['HAG', 2], ['ZEC', 14], ['MAL', 4],
  ['MAT', 28], ['MAR', 16], ['LUK', 24], ['JOH', 21], ['ACT', 28], ['ROM', 16], ['1CO', 16], ['2CO', 13],
  ['GAL', 6], ['EPH', 6], ['PHI', 4], ['COL', 4], ['1TH', 5], ['2TH', 3], ['1TI', 6], ['2TI', 4], ['TIT', 3],
  ['PHM', 1], ['HEB', 13], ['JAM', 5], ['1PE', 5], ['2PE', 3], ['1JO', 5], ['2JO', 1], ['3JO', 1], ['JUD', 1],
  ['REV', 22],
];
const TOTAL_VERSES = 31103;

const text = new Map(BOOKS.map(([code]) => [code, []]));
const line = /^(\w{3}) (\d+):(\d+) ?(.*)$/;
for (const raw of readFileSync(input, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
  const m = line.exec(raw);
  if (!m) continue;
  const book = text.get(m[1]);
  if (!book) throw new Error(`unknown book code ${m[1]}`);
  (book[Number(m[2]) - 1] ??= [])[Number(m[3]) - 1] = m[4].trim();
}

const problems = [];
let total = 0;
for (const [code, chapters] of BOOKS) {
  const book = text.get(code);
  if (book.length !== chapters) problems.push(`${code}: ${book.length} chapters, expected ${chapters}`);
  book.forEach((ch, c) => {
    if (!ch) return problems.push(`${code} ${c + 1}: missing chapter`);
    // A hole would serialise as null and show as a missing verse.
    ch.forEach((v, i) => v === undefined && problems.push(`${code} ${c + 1}:${i + 1}: hole`));
    for (let i = 0; i < ch.length; i++) if (ch[i] === undefined) ch[i] = '';
    total += ch.length;
  });
}
if (total !== TOTAL_VERSES) problems.push(`${total} verses, expected ${TOTAL_VERSES}`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const out = new URL('../public/text/en/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const [code] of BOOKS) writeFileSync(new URL(`${code}.json`, out), JSON.stringify(text.get(code)));
writeFileSync(
  new URL('books.json', out),
  JSON.stringify(Object.fromEntries(BOOKS.map(([code]) => [code, text.get(code).map((ch) => ch.length)]))),
);
console.log(`wrote ${BOOKS.length} books, ${total} verses`);
