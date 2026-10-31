import { useEffect, useState, type FormEvent } from 'react';
import { BOOKS, type Book } from '../lib/books';
import { formatPassage, parsePassage, RefError, type Lengths } from '../lib/refs';

/**
 * Choosing where to begin, the way a Bible is opened: its contents, then a chapter.
 * Typing a reference ("John 15:1-11") is offered too, for those who know exactly
 * where they are going.
 */
export default function Contents({ lengths, open }: { lengths: Lengths | null; open: (passage: string) => void }) {
  const [book, setBook] = useState<Book | null>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Open the Bible · Sermon Workshop';
  }, []);

  const go = (e: FormEvent) => {
    e.preventDefault();
    if (!lengths) return;
    try {
      open(formatPassage(parsePassage(typed, lengths)));
    } catch (err) {
      if (!(err instanceof RefError)) throw err;
      setError(err.message);
    }
  };

  const chapters = book && lengths ? lengths[book.code].length : 0;

  return (
    <section className="contents page-paper">
      {!book ? (
        <>
          <h1 className="contents-title">The Holy Bible</h1>
          <p className="contents-sub">Choose a book to begin a study.</p>
          <div className="testaments">
            {[
              ['The Old Testament', BOOKS.slice(0, 39)],
              ['The New Testament', BOOKS.slice(39)],
            ].map(([heading, list]) => (
              <div key={heading as string}>
                <h2>{heading as string}</h2>
                <ol className="book-list">
                  {(list as Book[]).map((b) => (
                    <li key={b.code}>
                      <button type="button" onClick={() => setBook(b)}>{b.name}</button>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <button type="button" className="quiet-link" onClick={() => setBook(null)}>‹ All books</button>
          <h1 className="contents-title">{book.name}</h1>
          <p className="contents-sub">Choose a chapter.</p>
          <ol className="chapter-grid">
            {Array.from({ length: chapters }, (_, i) => (
              <li key={i}>
                <button type="button" onClick={() => open(`${book.name} ${i + 1}`)}>{i + 1}</button>
              </li>
            ))}
          </ol>
        </>
      )}

      <form className="typed" onSubmit={go}>
        <label htmlFor="typed">Or type a passage</label>
        <span className="typed-row">
          <input
            id="typed"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              setError(null);
            }}
            placeholder="John 15:1-11"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" disabled={!typed.trim()}>Open</button>
        </span>
        {error && <span className="error" role="alert">{error}</span>}
      </form>
    </section>
  );
}
