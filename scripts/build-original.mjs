// The Bible in its original languages, word by word, for the verse panel: the Greek
// New Testament (SBLGNT) and the Hebrew Bible (Westminster Leningrad Codex), each word
// with its Strong's number, an English gloss and its grammar, from the MACULA datasets.
// Written to public/original/<BOOK>/<chapter>.json; the Strong's dictionaries to
// public/strongs/<G|H><hundreds>.json.
//
//   curl -L -o greek.tsv https://raw.githubusercontent.com/Clear-Bible/macula-greek/main/SBLGNT/tsv/macula-greek-SBLGNT.tsv
//   curl -L -o hebrew.tsv https://media.githubusercontent.com/media/Clear-Bible/macula-hebrew/main/WLC/tsv/macula-hebrew.tsv
//   curl -L -O https://raw.githubusercontent.com/openscriptures/strongs/master/greek/strongs-greek-dictionary.js
//   curl -L -O https://raw.githubusercontent.com/openscriptures/strongs/master/hebrew/strongs-hebrew-dictionary.js
//   node scripts/build-original.mjs greek.tsv hebrew.tsv strongs-greek-dictionary.js strongs-hebrew-dictionary.js
//
// Licences: MACULA Greek and Hebrew CC BY 4.0 (Biblica); SBLGNT CC BY 4.0 (SBL and Logos);
// WLC free to copy; Berean glosses public domain; Cherith glosses CC BY 4.0; Strong's
// dictionaries CC BY-SA (Open Scriptures). MACULA's @ln, @domain, @sdbh and other
// semantic-domain columns are "used with permission" only and are deliberately not read.
//
// Nothing here is matched to the English words: the WEB's own Strong's tags were
// measured and found wrong too often ("God" never tagged Elohim in Genesis, Psalms and
// Isaiah; "earth" tagged "heavens" 67 times in 89). The original is shown as itself.
//
// Hebrew verse numbers differ from English ones in places (psalm titles, Malachi 4,
// Joel 2-3). A chapter is laid against the English only where its verse count matches
// the WEB's; elsewhere it is marked "numbering differs" and no verse is offered as a
// match. A verse the WEB has and the Greek text lacks is marked absent, not left empty.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const [, , greekPath, hebrewPath, greekDict, hebrewDict] = process.argv;
if (!hebrewDict) {
  console.error('usage: node scripts/build-original.mjs greek.tsv hebrew.tsv strongs-greek-dictionary.js strongs-hebrew-dictionary.js');
  process.exit(1);
}

const USFM_TO_OURS = { SNG: 'SOL', EZK: 'EZE', JOL: 'JOE', NAM: 'NAH', MRK: 'MAR', JHN: 'JOH', PHP: 'PHI', JAS: 'JAM', '1JN': '1JO', '2JN': '2JO', '3JN': '3JO' };
const lengths = JSON.parse(readFileSync(new URL('../public/text/en/books.json', import.meta.url), 'utf8'));
const outDir = new URL('../public/original/', import.meta.url);
const dictDir = new URL('../public/strongs/', import.meta.url);
rmSync(outDir, { recursive: true, force: true });
rmSync(dictDir, { recursive: true, force: true });

/**
 * Why a verse the WEB has is missing from the SBLGNT. Each must be stated: the reasons
 * differ, and one message for all was false for most of them (2 Corinthians 13:14 is
 * in the Greek, numbered with 13:13). A missing verse with no reason here stops the
 * build. Verses the WEB itself leaves empty (Acts 8:37, its footnote) are not shown on
 * the page at all and need none.
 */
const MISSING = {
  later: ['MAT 17:21', 'MAT 18:11', 'MAT 23:14', 'MAR 7:16', 'MAR 9:44', 'MAR 9:46', 'MAR 11:26', 'MAR 15:28', 'LUK 23:17', 'JOH 5:4', 'ACT 28:29'],
  joined: ['2CO 13:14', 'ACT 19:41'],
  moved: ['ROM 14:24', 'ROM 14:25', 'ROM 14:26'],
};
const reasonFor = new Map(Object.entries(MISSING).flatMap(([why, refs]) => refs.map((r) => [r, why])));

/** Rows of a TSV as objects keyed by its header. */
function* rows(path) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const head = lines[0].split('\t');
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cells = lines[i].split('\t');
    yield Object.fromEntries(head.map((h, j) => [h, cells[j] ?? '']));
  }
}

// A plain transliteration of Greek, so a reader without Greek can say the word.
const GREEK = {
  α: 'a', β: 'b', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'ē', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o',
  π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'ph', χ: 'ch', ψ: 'ps', ω: 'ō',
};
function translitGreek(word) {
  const plain = word.normalize('NFD');
  const rough = /^[\p{L}]̔|^[\p{L}][\p{L}]̔/u.test(plain) || /^ῥ/.test(word);
  let out = '';
  const letters = plain.replace(/[̀-̓̕-ͯ]/g, '').replace(/̔/g, '');
  for (let i = 0; i < letters.length; i++) {
    const c = letters[i];
    const lower = c.toLowerCase();
    const t = GREEK[lower];
    if (!t) continue;
    // γ before γ, κ, ξ, χ is a nasal (ἄγγελος, angelos).
    const next = letters[i + 1]?.toLowerCase();
    let piece = lower === 'γ' && /[γκξχ]/.test(next ?? '') ? 'n' : t;
    // υ in a diphthong is u (αυ, ευ, ου).
    if (lower === 'υ' && /[αεηο]/.test(letters[i - 1]?.toLowerCase() ?? '')) piece = 'u';
    out += c !== lower && !out ? piece[0].toUpperCase() + piece.slice(1) : piece;
  }
  if (rough) out = /^[A-Z]/.test(out) ? `H${out[0].toLowerCase()}${out.slice(1)}` : `h${out}`;
  return out.replace(/^hr/, 'rh').replace(/^Hr/, 'Rh');
}

/** The grammar of a word, as words. */
const greekParse = (r) => [r.class, r.tense, r.voice, r.mood, r.person && `${r.person} person`, r.case, r.number, r.gender].filter(Boolean).join(' ');
const hebrewParse = (r) => [r.pos, r.stem, r.type, r.person && `${r.person} person`, r.gender, r.number, r.state].filter(Boolean).join(' ');

const readDict = (path) => {
  const js = readFileSync(path, 'utf8');
  return JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1));
};
const dicts = { G: readDict(greekDict), H: readDict(hebrewDict) };
/** A Hebrew word's letters without its vowels and accents, for comparing lemmas. */
const consonants = (s) => (s ?? '').normalize('NFD').replace(/[\u0591-\u05C7\u05BE]/g, '').trim();
/**
 * The Strong's number to look a word up by. Extended numbers ("0871a", "3807a") name
 * words Strong's never numbered; stripping the letter gave another word's entry ("of"
 * as "to bruise", H3807). The base entry is used only when it is the same word (the
 * same letters as the word's lemma: "1254a" is bara, create); otherwise the number is
 * kept as given and shown with no dictionary entry.
 */
const strong = (lang, n, lemma) => {
  const m = /^0*(\d+)([a-z]?)$/.exec(n ?? '');
  if (!m) return '';
  const base = `${lang}${m[1]}`;
  if (!m[2]) return base;
  const e = dicts[lang][base];
  return e && consonants(e.lemma) === consonants(lemma) ? base : `${base}${m[2]}`;
};
let extended = 0;
let extendedKept = 0;

const books = new Map(); // ours -> chapter -> verse -> entries
const parses = new Map(); // book -> chapter -> string[]
let words = 0;
let unwritten = 0;
function add(lang, r) {
  const m = /^(\S+) (\d+):(\d+)!(\d+)$/.exec(r.ref);
  if (!m) return;
  // An article the Hebrew implies but doesn't write (inside "ba-", "in the") has no
  // text: shown, it would be an empty word. Its sense is in the prefix's gloss.
  if (!r.text) {
    unwritten++;
    return;
  }
  const book = USFM_TO_OURS[m[1]] ?? m[1];
  const [c, v] = [Number(m[2]), Number(m[3])];
  const chapter = ((books.get(book) ?? books.set(book, new Map()).get(book)).get(c) ?? (books.get(book).set(c, { verses: {}, parses: [], lang })).get(c));
  const parse = lang === 'G' ? greekParse(r) : hebrewParse(r);
  let p = chapter.parses.indexOf(parse);
  if (p < 0) p = chapter.parses.push(parse) - 1;
  const number = lang === 'G' ? strong('G', r.strong, r.lemma) : strong('H', r.strongnumberx, r.lemma);
  if (lang === 'H' && /[a-z]$/.test(r.strongnumberx ?? '')) {
    extended++;
    if (!/[a-z]$/.test(number)) extendedKept++;
  }
  // Hebrew parts of one written word share its number in the reference ("!2").
  const entry = lang === 'G'
    ? [r.text, translitGreek(r.text), number, r.gloss || r.english, p, r.after]
    : [r.text, r.transliteration, number, r.english || r.gloss, p, r.after, r.greek && r.greekstrong ? `${r.greek} G${Number(r.greekstrong)}` : '', Number(m[4])];
  (chapter.verses[v] ??= []).push(entry);
  words++;
}
for (const r of rows(greekPath)) add('G', r);
for (const r of rows(hebrewPath)) add('H', r);

let chapters = 0;
let differs = 0;
let absent = 0;
const problems = [];
for (const [book, chs] of books) {
  if (!lengths[book]) {
    problems.push(`unknown book ${book}`);
    continue;
  }
  mkdirSync(new URL(`${book}/`, outDir), { recursive: true });
  for (const [c, ch] of chs) {
    const english = lengths[book][c - 1] ?? 0;
    const original = Math.max(...Object.keys(ch.verses).map(Number));
    const out = { lang: ch.lang === 'G' ? 'greek' : 'hebrew', parses: ch.parses, verses: ch.verses };
    if (ch.lang === 'H' && original !== english) {
      // Laid against the English, these verses would be the wrong ones.
      out.numbering = 'differs';
      out.verses = {};
      differs++;
    } else if (ch.lang === 'G' && original > english) {
      // The critical text divides a few chapter ends differently (3 John 14 is its 14
      // and 15; Revelation 12:18 is the WEB's 13:1). Verses past the English end are
      // left out and the chapter says its end is numbered differently.
      for (const v of Object.keys(ch.verses)) if (Number(v) > english) delete ch.verses[v];
      out.numbering = 'end-differs';
    }
    if (ch.lang === 'G') {
      // Verses the WEB has (with words) that this Greek text doesn't, each with why.
      const web = JSON.parse(readFileSync(new URL(`../public/text/en/${book}.json`, import.meta.url), 'utf8'))[c - 1];
      out.absent = {};
      for (let v = 1; v <= english; v++) {
        if (ch.verses[v] || !web[v - 1]?.trim()) continue;
        const why = reasonFor.get(`${book} ${c}:${v}`);
        if (!why) problems.push(`${book} ${c}:${v} is missing from the Greek with no stated reason`);
        out.absent[v] = why;
        absent++;
      }
    }
    writeFileSync(new URL(`${book}/${c}.json`, outDir), JSON.stringify(out));
    chapters++;
  }
  // An English chapter with no original at all (Malachi 4 is Hebrew 3:19-24).
  for (let c = 1; c <= lengths[book].length; c++) {
    if (!chs.has(c)) {
      writeFileSync(new URL(`${book}/${c}.json`, outDir), JSON.stringify({ lang: books.get(book).values().next().value.lang === 'G' ? 'greek' : 'hebrew', numbering: 'differs', parses: [], verses: {} }));
      differs++;
    }
  }
}
if (books.size !== 66) problems.push(`${books.size} books, expected 66`);

// Strong's dictionaries, in files of a hundred entries, fetched as a word is opened.
mkdirSync(dictDir, { recursive: true });
let entries = 0;
for (const lang of ['G', 'H']) {
  const buckets = new Map();
  for (const [key, e] of Object.entries(dicts[lang])) {
    const n = Number(key.slice(1));
    if (!Number.isFinite(n)) continue;
    const b = Math.floor(n / 100);
    (buckets.get(b) ?? buckets.set(b, {}).get(b))[`${lang}${n}`] = [e.lemma, e.translit ?? e.xlit ?? '', (e.strongs_def ?? '').trim(), (e.kjv_def ?? '').trim(), (e.derivation ?? '').trim()];
    entries++;
  }
  for (const [b, set] of buckets) writeFileSync(new URL(`${lang}${b}.json`, dictDir), JSON.stringify(set));
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`Hebrew extended Strong's numbers: ${extended}; ${extendedKept} are the same word as their base entry and use it`);
console.log(`${words} words in ${chapters} chapters (${unwritten} unwritten Hebrew articles left out); ${differs} chapters numbered differently from the English (Hebrew); ${absent} WEB verses absent from the Greek; ${entries} dictionary entries`);
