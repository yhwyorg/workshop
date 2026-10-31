import { useEffect, useState } from 'react';
import { BY_CODE } from '../lib/books';
import { loadEntry, loadOriginal, written, type Entry, type OriginalChapter, type Word } from '../lib/original';
import { loadReference, REFERENCES, type Loaded, type Reference } from '../lib/reference';
import { chapterOf, key, verseOf, versesIn, type Lengths, type Passage } from '../lib/refs';
import { loadBook } from '../lib/text';
import { crossReferences, loadXrefs, testament as testamentOf, xrefLabel, type Xrefs } from '../lib/xref';

/** One verse, as the panel shows it. */
interface At {
  book: string;
  chapter: number;
  verse: number;
}

/**
 * Asked of every verse: Tyndale's study notes (strong on history and background), JFB
 * (close to the words), and Henry (for preaching). Commentaries open beside the Bible
 * are asked as well.
 */
const ASKED = ['tyndale', 'jamieson-fausset-brown', 'matthew-henry'];

/** A cross-reference shows at most this many of its verses; the label says the rest. */
const SHOWN = 3;

const place = (at: At) => `${BY_CODE.get(at.book)!.name} ${at.chapter}:${at.verse}`;

/**
 * A verse, opened by tapping its number: its words, where else Scripture speaks to it,
 * and what the commentaries say. A cross-reference opens in the same panel, with a way
 * back, so a thread can be followed from verse to verse.
 */
export default function VersePanel({ start, lengths, open, close }: {
  start: At;
  lengths: Lengths;
  /** References open beside the Bible; their commentaries are asked too. */
  open: Reference[];
  close: () => void;
}) {
  const [trail, setTrail] = useState<At[]>([start]);
  const at = trail.at(-1)!;
  const title = place(at);

  useEffect(() => setTrail([start]), [start.book, start.chapter, start.verse]); // eslint-disable-line react-hooks/exhaustive-deps -- a new verse starts a new trail

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [close]);

  const follow = (p: Passage) => setTrail((t) => [...t, { book: p.book, chapter: chapterOf(p.start), verse: verseOf(p.start) }]);
  const back = trail.length > 1 ? trail.at(-2)! : null;
  const commentaries = [
    ...ASKED.map((id) => REFERENCES.find((r) => r.id === id)!),
    ...open.filter((r) => r.kind === 'commentary' && !ASKED.includes(r.id)),
  ];

  return (
    <div className="verse-panel" role="dialog" aria-label={title}>
      <div className="vp-head">
        {back && (
          <button type="button" className="quiet-link vp-back" onClick={() => setTrail((t) => t.slice(0, -1))} aria-label={`Back to ${place(back)}`}>
            ‹ {place(back)}
          </button>
        )}
        <h2 className="vp-title">{title}</h2>
        <button type="button" className="tb-icon vp-close" onClick={close} aria-label={`Close ${title}`} title="Close">×</button>
      </div>
      <div className="vp-body" key={title}>
        <Words passage={{ book: at.book, start: key(at.chapter, at.verse), end: key(at.chapter, at.verse) }} lengths={lengths} className="vp-verse" />
        <Original at={at} last={lengths[at.book][at.chapter - 1]} />
        <CrossReferences at={at} lengths={lengths} follow={follow} />
        <section className="vp-section" role="region" aria-label="From the commentaries">
          <h3 className="vp-h">From the commentaries</h3>
          {commentaries.map((r) => <Note key={r.id} reference={r} at={at} />)}
        </section>
      </div>
    </div>
  );
}

/** The words of a passage, from the World English Bible already on this site. */
function Words({ passage, lengths, className }: { passage: Passage; lengths: Lengths; className?: string }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    loadBook(passage.book).then(
      (book) => {
        if (!live) return;
        const keys = versesIn(passage, lengths[passage.book]);
        const shown = keys.slice(0, SHOWN).map((k) => book[chapterOf(k) - 1]?.[verseOf(k) - 1] ?? '');
        setText(shown.join(' ') + (keys.length > SHOWN ? ' …' : ''));
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [passage.book, passage.start, passage.end, lengths]); // eslint-disable-line react-hooks/exhaustive-deps -- the passage object is new each render; its fields are what matter
  if (failed) return <p className={`${className ?? ''} error`}>The words couldn’t be opened.</p>;
  return <p className={className}>{text ?? '…'}</p>;
}

function CrossReferences({ at, lengths, follow }: { at: At; lengths: Lengths; follow: (p: Passage) => void }) {
  const [x, setX] = useState<Xrefs | 'failed' | null>(null);
  useEffect(() => {
    let live = true;
    setX(null);
    loadXrefs(at.book).then((v) => live && setX(v), () => live && setX('failed'));
    return () => {
      live = false;
    };
  }, [at.book]);

  if (x === null) return <p className="quiet">Finding cross-references…</p>;
  if (x === 'failed') return <p className="error" role="alert">The cross-references couldn’t be opened. Check the connection and open the verse again.</p>;
  const groups = crossReferences(x, at.book, at.chapter, at.verse);
  if (!groups.some((g) => g.refs.length)) return <p className="quiet">No cross-references are listed for this verse.</p>;
  return (
    <>
      {groups.filter((g) => g.refs.length).map((g) => {
        const name = g.testament === 'old' ? 'In the Old Testament' : 'In the New Testament';
        return (
          <section key={g.testament} className="vp-section" role="region" aria-label={name}>
            <h3 className="vp-h">{name}</h3>
            <ul className="vp-refs">
              {g.refs.map((p) => (
                <li key={xrefLabel(p)}>
                  <button type="button" className="vp-ref" onClick={() => follow(p)}>{xrefLabel(p)}</button>
                  <Words passage={p} lengths={lengths} className="vp-words" />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="vp-credit">
        Cross-references from <a href="https://www.openbible.info/labs/cross-references/">OpenBible.info</a> (CC BY), ranked by readers’ votes; related passages, not only quotations.
      </p>
    </>
  );
}

/** What one commentary says: the note that covers the verse, and where that note begins. */
function Note({ reference: r, at }: { reference: Reference; at: At }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    let live = true;
    setLoaded(null);
    setAll(false);
    loadReference(r, at.book, at.chapter).then((l) => live && setLoaded(l));
    return () => {
      live = false;
    };
  }, [r, at.book, at.chapter]);

  if (!loaded) return <p className="quiet">{r.name}…</p>;
  if (loaded.state === 'failed') {
    return (
      <p className="error" role="alert">
        {r.name} {loaded.reason === 'unreachable' ? 'couldn’t be reached; it needs a connection.' : `couldn’t be read: ${loaded.message}.`}
      </p>
    );
  }
  // Notes are keyed by the verse they begin at; the one covering this verse is the last
  // to begin at or before it.
  // Asked and empty is said, not left blank: blank would read as "never asked".
  // Before a commentary's first note, its introduction to the chapter is what it says
  // of the verse (JFB on Psalm 22:1); it is labelled as being on the chapter.
  const covering = loaded.state === 'commentary' ? loaded.notes.filter((n) => n.verse <= at.verse).at(-1) : undefined;
  const intro = loaded.state === 'commentary' && loaded.introduction?.length ? { verse: 0, paragraphs: loaded.introduction } : undefined;
  const note = covering ?? intro;
  if (!note) return <p className="quiet vp-none">Nothing from {r.name} on this verse.</p>;
  const paragraphs = all ? note.paragraphs : note.paragraphs.slice(0, 2);
  return (
    <article className="vp-note">
      <p className="vp-who">
        {r.name} · {note.verse === 0 ? 'on the chapter' : `${note.verse === at.verse ? 'on' : 'from'} verse ${note.verse}`}
      </p>
      {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      {note.paragraphs.length > 2 && !all && (
        <button type="button" className="quiet-link" onClick={() => setAll(true)}>Read the whole note</button>
      )}
      {r.attribution && <p className="vp-credit">{r.attribution}</p>}
    </article>
  );
}

/**
 * The verse in its original language, word by word, each with a gloss; a word opened
 * shows its dictionary entry and grammar. Not matched to the English words: the
 * matching available was measured wrong too often (see build-original.mjs).
 */
function Original({ at, last }: { at: At; last: number }) {
  const [ch, setCh] = useState<OriginalChapter | 'failed' | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    setCh(null);
    setOpen(null);
    loadOriginal(at.book, at.chapter).then((c) => live && setCh(c), () => live && setCh('failed'));
    return () => {
      live = false;
    };
  }, [at.book, at.chapter, at.verse]);

  const hebrew = testamentOf(at.book) === 'old';
  const name = hebrew ? 'In the Hebrew' : 'In the Greek';
  const body = (() => {
    if (ch === null) return <p className="quiet">Opening the {hebrew ? 'Hebrew' : 'Greek'}…</p>;
    if (ch === 'failed') return <p className="error" role="alert">The {hebrew ? 'Hebrew' : 'Greek'} couldn’t be opened. Check the connection and open the verse again.</p>;
    if (ch.numbering === 'differs') {
      return (
        <p className="quiet">
          The Hebrew Bible numbers this chapter differently from English Bibles (a psalm’s title is often a verse of its own),
          so its verses aren’t matched here yet.
        </p>
      );
    }
    const why = ch.absent?.[at.verse];
    if (why) {
      return (
        <p className="quiet">
          {why === 'later'
            ? 'This verse isn’t in the Greek text used here (the SBL Greek New Testament, from the oldest manuscripts). It is found in later manuscripts, which the World English Bible follows.'
            : why === 'joined'
              ? 'The Greek text numbers these words as part of the verse before; open that verse to see them.'
              : 'In the Greek text used here these words come at the end of the letter, at Romans 16:25–27.'}
        </p>
      );
    }
    const words = ch.verses[at.verse];
    if (!words?.length) return <p className="quiet">No {hebrew ? 'Hebrew' : 'Greek'} is given for this verse.</p>;
    const groups = written(words);
    return (
      <>
        <div className={`og-words${hebrew ? ' hebrew' : ''}`} dir={hebrew ? 'rtl' : 'ltr'} lang={hebrew ? 'he' : 'grc'}>
          {groups.map((g, i) => (
            <button key={i} type="button" className="og-word" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <span className="og-text">{g.map((w) => w[0]).join('')}</span>
              <span className="og-tr" lang="en" dir="ltr">{g.map((w) => w[1]).join('')}</span>
              <span className="og-gl" lang="en" dir="ltr">{g.map((w) => w[3]).join(' ')}</span>
            </button>
          ))}
        </div>
        {open !== null && groups[open] && (
          <div className="og-entry" role="group" aria-label={groups[open].map((w) => w[0]).join('')}>
            {groups[open].map((w, i) => <Part key={i} word={w} parse={ch.parses[w[4]]} hebrew={hebrew} />)}
          </div>
        )}
        {ch.numbering === 'end-differs' && at.verse === last && (
          <p className="quiet">The Greek divides the end of this chapter differently, so this may be only part of the Greek’s last verse.</p>
        )}
      </>
    );
  })();

  return (
    <section className="vp-section" role="region" aria-label={name}>
      <h3 className="vp-h">{name}</h3>
      {body}
      <p className="vp-credit">
        {hebrew ? (
          <>Westminster Leningrad Codex; words, glosses and grammar from <a href="https://github.com/Clear-Bible/macula-hebrew/">MACULA Hebrew</a> (CC BY 4.0, Biblica) with Cherith glosses (CC BY 4.0).</>
        ) : (
          <>SBL Greek New Testament (CC BY 4.0, SBL and Logos); words, glosses and grammar from <a href="https://github.com/Clear-Bible/macula-greek/">MACULA Greek</a> (CC BY 4.0, Biblica) with Berean glosses (public domain).</>
        )}{' '}
        Dictionary: Strong’s (1890), from <a href="https://github.com/openscriptures/strongs">Open Scriptures</a> (CC BY-SA).
      </p>
    </section>
  );
}

/** One word (or one part of a Hebrew word): its dictionary entry, grammar and gloss. */
function Part({ word, parse, hebrew }: { word: Word; parse: string; hebrew: boolean }) {
  const [entry, setEntry] = useState<Entry | null | 'failed' | undefined>(undefined);
  useEffect(() => {
    let live = true;
    loadEntry(word[2]).then((e) => live && setEntry(e ?? null), () => live && setEntry('failed'));
    return () => {
      live = false;
    };
  }, [word]);
  const [lxx, lxxNumber] = (word[6] ?? '').split(' ');
  return (
    <div className="og-part">
      <p className="og-head">
        <span className="og-lemma" lang={hebrew ? 'he' : 'grc'} dir={hebrew ? 'rtl' : 'ltr'}>{entry && entry !== 'failed' ? entry[0] : word[0]}</span>
        {' '}<span className="og-tr">{entry && entry !== 'failed' ? entry[1] : word[1]}</span>
        {word[2] && <span className="og-num"> · {word[2]}</span>}
      </p>
      <p className="og-parse">“{word[3]}” · {parse}</p>
      {entry === undefined ? (
        <p className="quiet">Opening the dictionary…</p>
      ) : entry === 'failed' ? (
        <p className="error" role="alert">The dictionary couldn’t be opened.</p>
      ) : entry === null ? (
        // Mostly a prefix or ending ("and", "the", "my"), which Strong's doesn't number
        // on its own; its gloss and grammar above say what it is.
        <p className="quiet">Strong’s has no entry for this exact word.</p>
      ) : (
        <>
          <p className="og-def">{entry[2]}</p>
          {entry[3] && <p className="og-kjv">KJV: {entry[3]}</p>}
          {entry[4] && <p className="og-kjv">{entry[4]}</p>}
        </>
      )}
      {lxx && <p className="og-kjv">Septuagint: <span lang="grc">{lxx}</span> ({lxxNumber})</p>}
    </div>
  );
}
