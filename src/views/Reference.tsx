import { useEffect, useState } from 'react';
import { loadReference, REFERENCES, type Loaded, type Reference } from '../lib/reference';

/** The choice of reference, opened from Compare in the toolbar. */
export function ReferencePicker({ current, choose }: { current: Reference | null; choose: (r: Reference) => void }) {
  const group = (kind: Reference['kind'], title: string) => (
    <>
      <p className="picker-head">{title}</p>
      <ul className="ref-choices">
        {REFERENCES.filter((r) => r.kind === kind).map((r) => (
          <li key={r.id}>
            <button type="button" aria-pressed={r.id === current?.id} onClick={() => choose(r)}>
              <span className="ref-name">{r.name}</span>
              {r.scope && <span className="ref-scope"> {r.scope}</span>}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
  return (
    <div className="chapter-picker ref-picker" role="dialog" aria-label="Compare with">
      {group('translation', 'Translations')}
      {group('commentary', 'Commentaries')}
    </div>
  );
}

/**
 * Another translation or a commentary, at the chapter the Bible is open to. It follows
 * the Bible as the chapter turns; it never leads it.
 */
export function ReferenceText({ reference: r, book, bookName, chapter, close }: {
  reference: Reference;
  book: string;
  bookName: string;
  chapter: number;
  close: () => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | { state: 'loading' }>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const place = `${bookName} ${chapter}`;

  useEffect(() => {
    let live = true;
    setLoaded({ state: 'loading' });
    loadReference(r, book, chapter).then((l) => live && setLoaded(l));
    return () => {
      live = false;
    };
  }, [r, book, chapter, attempt]);

  const retry = <button type="button" className="quiet-link" onClick={() => setAttempt((a) => a + 1)}>Try again</button>;

  return (
    <div className="ref-col">
      <div className="ref-head">
        <p className="book-name">{r.name}</p>
        <button type="button" className="tb-icon ref-close" onClick={close} aria-label={`Close ${r.name}`} title="Close">×</button>
      </div>
      <p className="ref-place">{place}</p>
      {loaded.state === 'loading' ? (
        <p className="quiet">Opening {r.name}…</p>
      ) : loaded.state === 'not-covered' ? (
        // The source has no such chapter: an answer, not a failure, and never shown as one.
        <p className="quiet">Nothing from {r.name} on {place}.</p>
      ) : loaded.state === 'failed' ? (
        <div className="error" role="alert">
          {loaded.reason === 'unreachable' ? (
            <p>{r.name} couldn’t be reached. It comes over the internet, so it needs a connection. Your study is untouched.</p>
          ) : (
            <p>{r.name} for {place} couldn’t be read: {loaded.message}.</p>
          )}
          {retry}
        </div>
      ) : loaded.state === 'translation' ? (
        <div className="ref-text">
          {sections(loaded.verses, loaded.headings).map(({ heading, verses }) => (
            <div key={verses[0].number}>
              {heading && <h3 className="ref-heading">{heading}</h3>}
              <p>
                {verses.map((v) => (
                  <span key={v.number}>
                    <sup className="vn">{v.number}</sup>
                    {v.text}{' '}
                  </span>
                ))}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="ref-text commentary">
          {loaded.introduction?.map((p, i) => <p key={`i${i}`}>{p}</p>)}
          {loaded.notes.map((n) => (
            <section key={n.verse}>
              {/* Where the note begins; the source doesn't say where it ends. */}
              <h3 className="ref-heading">Verse {n.verse}</h3>
              {n.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </section>
          ))}
        </div>
      )}
      <p className="translation">
        {r.attribution ?? `${r.name} · ${r.licence}`}
        {!r.attribution && <> · via the <a href="https://bible.helloao.org/">Free Use Bible API</a></>}
      </p>
    </div>
  );
}

/** The verses in runs, each starting at a heading (the first may have none). */
function sections(verses: { number: number; text: string }[], headings: Record<number, string>) {
  const out: { heading?: string; verses: typeof verses }[] = [];
  for (const v of verses) {
    if (!out.length || headings[v.number]) out.push({ heading: headings[v.number], verses: [] });
    out.at(-1)!.verses.push(v);
  }
  return out;
}
