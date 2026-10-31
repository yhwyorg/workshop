/** The 66 books, keyed by the eBible VPL codes that name the files in public/text/en/. */
export interface Book {
  code: string;
  name: string;
  /** Other spellings the passage box accepts (lowercase, no dots or spaces). */
  aliases: string[];
}

const b = (code: string, name: string, ...aliases: string[]): Book => ({ code, name, aliases });

export const BOOKS: Book[] = [
  b('GEN', 'Genesis', 'gen', 'ge', 'gn'),
  b('EXO', 'Exodus', 'exod', 'exo', 'ex'),
  b('LEV', 'Leviticus', 'lev', 'lv'),
  b('NUM', 'Numbers', 'num', 'nm', 'nu'),
  b('DEU', 'Deuteronomy', 'deut', 'deu', 'dt'),
  b('JOS', 'Joshua', 'josh', 'jos'),
  b('JDG', 'Judges', 'judg', 'jdg', 'jg'),
  b('RUT', 'Ruth', 'ru', 'rth'),
  b('1SA', '1 Samuel', '1sam', '1sa', '1sm'),
  b('2SA', '2 Samuel', '2sam', '2sa', '2sm'),
  b('1KI', '1 Kings', '1kgs', '1ki', '1kg'),
  b('2KI', '2 Kings', '2kgs', '2ki', '2kg'),
  b('1CH', '1 Chronicles', '1chr', '1ch', '1chron'),
  b('2CH', '2 Chronicles', '2chr', '2ch', '2chron'),
  b('EZR', 'Ezra', 'ezr'),
  b('NEH', 'Nehemiah', 'neh', 'ne'),
  b('EST', 'Esther', 'esth', 'est'),
  b('JOB', 'Job', 'jb'),
  b('PSA', 'Psalms', 'psalm', 'ps', 'psa', 'pss'),
  b('PRO', 'Proverbs', 'prov', 'pro', 'pr', 'prv'),
  b('ECC', 'Ecclesiastes', 'eccl', 'ecc', 'qoh'),
  b('SOL', 'Song of Songs', 'songofsolomon', 'song', 'sos', 'sng', 'canticles'),
  b('ISA', 'Isaiah', 'isa', 'is'),
  b('JER', 'Jeremiah', 'jer', 'je'),
  b('LAM', 'Lamentations', 'lam', 'la'),
  b('EZE', 'Ezekiel', 'ezek', 'eze', 'ezk'),
  b('DAN', 'Daniel', 'dan', 'dn', 'da'),
  b('HOS', 'Hosea', 'hos', 'ho'),
  b('JOE', 'Joel', 'jl', 'joe'),
  b('AMO', 'Amos', 'am', 'amo'),
  b('OBA', 'Obadiah', 'obad', 'ob', 'oba'),
  b('JON', 'Jonah', 'jon', 'jnh'),
  b('MIC', 'Micah', 'mic', 'mi'),
  b('NAH', 'Nahum', 'nah', 'na'),
  b('HAB', 'Habakkuk', 'hab', 'hb'),
  b('ZEP', 'Zephaniah', 'zeph', 'zep', 'zp'),
  b('HAG', 'Haggai', 'hag', 'hg'),
  b('ZEC', 'Zechariah', 'zech', 'zec', 'zc'),
  b('MAL', 'Malachi', 'mal', 'ml'),
  b('MAT', 'Matthew', 'matt', 'mat', 'mt'),
  b('MAR', 'Mark', 'mrk', 'mar', 'mk', 'mr'),
  b('LUK', 'Luke', 'luk', 'lk', 'lu'),
  b('JOH', 'John', 'jhn', 'joh', 'jn'),
  b('ACT', 'Acts', 'act', 'ac'),
  b('ROM', 'Romans', 'rom', 'ro', 'rm'),
  b('1CO', '1 Corinthians', '1cor', '1co'),
  b('2CO', '2 Corinthians', '2cor', '2co'),
  b('GAL', 'Galatians', 'gal', 'ga'),
  b('EPH', 'Ephesians', 'eph', 'ephes'),
  b('PHI', 'Philippians', 'phil', 'php', 'pp'),
  b('COL', 'Colossians', 'col'),
  b('1TH', '1 Thessalonians', '1thess', '1th', '1ths'),
  b('2TH', '2 Thessalonians', '2thess', '2th', '2ths'),
  b('1TI', '1 Timothy', '1tim', '1ti', '1tm'),
  b('2TI', '2 Timothy', '2tim', '2ti', '2tm'),
  b('TIT', 'Titus', 'tit', 'ti'),
  b('PHM', 'Philemon', 'philem', 'phm', 'pm'),
  b('HEB', 'Hebrews', 'heb'),
  b('JAM', 'James', 'jas', 'jam', 'jm'),
  b('1PE', '1 Peter', '1pet', '1pe', '1pt'),
  b('2PE', '2 Peter', '2pet', '2pe', '2pt'),
  b('1JO', '1 John', '1jn', '1jo', '1jhn', '1joh'),
  b('2JO', '2 John', '2jn', '2jo', '2jhn', '2joh'),
  b('3JO', '3 John', '3jn', '3jo', '3jhn', '3joh'),
  b('JUD', 'Jude', 'jud', 'jd'),
  b('REV', 'Revelation', 'rev', 're', 'rv', 'revelations', 'apocalypse'),
];

export const BY_CODE = new Map(BOOKS.map((x) => [x.code, x]));

/** Lowercase, with spaces, dots and "st/nd/rd" ordinals removed: "1st Cor." -> "1cor". */
export const fold = (s: string) => s.toLowerCase().replace(/^([123])(st|nd|rd)/, '$1').replace(/[.\s]/g, '');

/** Every accepted spelling, folded -> book code. Roman numerals ("II Kings") are accepted too. */
export const ALIASES: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const book of BOOKS) {
    for (const s of [book.name, book.code, ...book.aliases]) {
      const f = fold(s);
      // "II Kings", "I Sam": Roman numerals only before three or more letters. "1sa" as
      // "isa" would take Isaiah's abbreviation, and the clash check below caught exactly that.
      const roman = /^[123][a-z]{3}/.test(f) ? f.replace(/^1/, 'i').replace(/^2/, 'ii').replace(/^3/, 'iii') : f;
      for (const k of roman === f ? [f] : [f, roman]) {
        // Two books sharing a spelling would send one of them to the other, silently.
        const had = m.get(k);
        if (had && had !== book.code) throw new Error(`"${k}" names both ${had} and ${book.code}`);
        m.set(k, book.code);
      }
    }
  }
  return m;
})();
