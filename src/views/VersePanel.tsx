import { useEffect, useState } from 'react';
import { BY_CODE } from '../lib/books';
import { loadReference, REFERENCES, type Loaded, type Reference } from '../lib/reference';
import { chapterOf, key, verseOf, versesIn, type Lengths, type Passage } from '../lib/refs';
import { loadBook } from '../lib/text';
import { crossReferences, loadXrefs, xrefLabel, type Xrefs } from '../lib/xref';

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
