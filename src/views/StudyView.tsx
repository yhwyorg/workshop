import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BY_CODE } from '../lib/books';
import { TOOL_STYLE } from '../lib/ink';
import { chapterOf, key, parsePassage, verseOf, type Lengths, type Passage, type VerseKey } from '../lib/refs';
import { href } from '../lib/route';
import { nextMark, SHEETS, TOOLS, type Ink, type Mark, type Sheet, type Study } from '../lib/studies';
import { loadBook } from '../lib/text';
import InkSurface, { type PenTool } from './Ink';

/** Headings for the first version's sheets, shown only where something was written on them. */
const OLD_SHEETS: Partial<Record<Sheet, string>> = {
  observe: 'Observations',
  questions: 'Questions',
  connections: 'Connections',
  bigIdea: 'Big idea',
  outline: 'Outline',
  illustrations: 'Illustrations',
  application: 'Application',
};

const MARK_WORD: Record<Mark, string> = { underline: 'underlined', circle: 'circled', box: 'boxed' };

type Book = { state: 'loading' } | { state: 'ready'; text: string[][] } | { state: 'failed'; message: string };

export default function StudyView({ study, lengths, update }: {
  study: Study | undefined;
  lengths: Lengths | null;
  update: (id: string, change: (s: Study) => Study) => void;
}) {
  const passage: Passage | null = (() => {
    if (!study || !lengths) return null;
    try {
      return parsePassage(study.passage, lengths);
    } catch {
      return null;
    }
  })();
  const [chapter, setChapter] = useState<number | null>(null);
  const [book, setBook] = useState<Book>({ state: 'loading' });
  const [tool, setTool] = useState<PenTool>('pen');
  const [mouseDraws, setMouseDraws] = useState(false);
  // What each change of ink replaced, newest last, so Undo can put it back.
  const [history, setHistory] = useState<{ surface: string; before: Ink | undefined }[]>([]);

  useEffect(() => {
    if (study) document.title = `${study.title || study.passage} · Sermon Workshop`;
  }, [study]);

  // Open at the study's own chapter, and again whenever a different study is opened.
  useEffect(() => {
    setChapter(passage ? chapterOf(passage.start) : null);
    setHistory([]);
  }, [study?.id, passage?.book]); // eslint-disable-line react-hooks/exhaustive-deps -- only a new study resets the page

  useEffect(() => {
    if (!passage) return;
    let live = true;
    setBook({ state: 'loading' });
    loadBook(passage.book).then(
      (text) => live && setBook({ state: 'ready', text }),
      (e: Error) => live && setBook({ state: 'failed', message: e.message }),
    );
    return () => {
      live = false;
    };
  }, [passage?.book]); // eslint-disable-line react-hooks/exhaustive-deps -- the book is all that matters

  if (!study) {
    return (
      <p className="page-paper notice" role="alert">
        This study isn’t on this device. Studies stay in the browser where they were written.{' '}
        <a href={href.studies()}>See your studies</a>
      </p>
    );
  }
  if (!passage) {
    return <p className="page-paper notice" role="alert">“{study.passage}” couldn’t be opened.</p>;
  }

  const setInk = (surface: string) => (ink: Ink) => {
    setHistory((h) => [...h.slice(-49), { surface, before: study.ink?.[surface] }]);
    update(study.id, (s) => ({ ...s, ink: { ...s.ink, [surface]: ink } }));
  };
  const undo = () => {
    const last = history.at(-1);
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    update(study.id, (s) => {
      const ink = { ...s.ink };
      if (last.before) ink[last.surface] = last.before;
      else delete ink[last.surface];
      return { ...s, ink };
    });
  };
  const mark = (k: VerseKey, i: number) =>
    update(study.id, (s) => {
      const id = `${k}:${i}`;
      const next = nextMark(s.marks[id]);
      const marks = { ...s.marks };
      if (next) marks[id] = next;
      else delete marks[id];
      return { ...s, marks };
    });

  const ch = chapter ?? chapterOf(passage.start);
  const pen = { tool, mouseDraws };

  return (
    <div className="spread">
      <BiblePage
        passage={passage}
        chapter={ch}
        chapters={lengths![passage.book].length}
        go={setChapter}
        book={book}
        marks={study.marks}
        onMark={mark}
        ink={study.ink?.[`bible:${ch}`]}
        setInk={setInk(`bible:${ch}`)}
        {...pen}
      />
      <LegalPad study={study} update={update} ink={study.ink?.pad} setInk={setInk('pad')} {...pen} />
      {/* Print only, for "Print with lines to write on". */}
      <div className="print-lines" aria-hidden="true">
        {Array.from({ length: 36 }, (_, i) => <span key={i} />)}
      </div>
      <PenCup tool={tool} setTool={setTool} undo={undo} canUndo={history.length > 0} mouseDraws={mouseDraws} setMouseDraws={setMouseDraws} />
    </div>
  );
}

function BiblePage({ passage, chapter, chapters, go, book, marks, onMark, ink, setInk, tool, mouseDraws }: {
  passage: Passage;
  chapter: number;
  chapters: number;
  go: (c: number) => void;
  book: Book;
  marks: Record<string, Mark>;
  onMark: (k: VerseKey, i: number) => void;
  ink: Ink | undefined;
  setInk: (ink: Ink) => void;
  tool: PenTool;
  mouseDraws: boolean;
}) {
  const name = BY_CODE.get(passage.book)!.name;
  const [jump, setJump] = useState(false);
  const inStudy = (k: VerseKey) => k >= passage.start && k <= passage.end;
  // A study of whole chapters needs no emphasis; a few verses within a chapter are set
  // off from the verses around them, which stay on the page for context.
  const wholeChapters =
    book.state === 'ready' &&
    verseOf(passage.start) === 1 &&
    verseOf(passage.end) === book.text[chapterOf(passage.end) - 1].length;
  const partial = !wholeChapters;

  return (
    <article className="bible-page" aria-label={`${name} ${chapter}`}>
      <header className="running-head">
        <button type="button" onClick={() => setJump((j) => !j)} aria-expanded={jump}>
          {name} {chapter}
        </button>
      </header>
      {jump && (
        <ol className="chapter-grid compact" aria-label={`Chapters of ${name}`}>
          {Array.from({ length: chapters }, (_, i) => (
            <li key={i}>
              <button
                type="button"
                aria-current={i + 1 === chapter ? 'page' : undefined}
                onClick={() => {
                  go(i + 1);
                  setJump(false);
                }}
              >
                {i + 1}
              </button>
            </li>
          ))}
        </ol>
      )}

      <InkSurface ink={ink} onChange={setInk} tool={tool} mouseDraws={mouseDraws} className="bible-text">
        {book.state === 'loading' ? (
          <p className="quiet">Opening {name}…</p>
        ) : book.state === 'failed' ? (
          <p className="error" role="alert">{name} couldn’t be opened: {book.message}</p>
        ) : (
          <p className={`scripture${partial ? ' partial' : ''}${ink?.strokes.length ? ' inked' : ''}`}>
            <span className="drop" aria-hidden="true">{chapter}</span>
            {book.text[chapter - 1].map((text, vi) => {
              const k = key(chapter, vi + 1);
              let i = -1;
              return (
                <span key={k} className={inStudy(k) ? 'v in-study' : 'v'}>
                  {vi > 0 && <sup className="vn">{vi + 1}</sup>}
                  {text.split(/(\s+)/).map((tok, ti) => {
                    if (/^\s*$/.test(tok)) return <Fragment key={ti}>{tok}</Fragment>;
                    i++;
                    const at = i;
                    const m = marks[`${k}:${at}`];
                    return (
                      <button
                        key={ti}
                        type="button"
                        className={`word${m ? ` mark-${m}` : ''}`}
                        onClick={() => onMark(k, at)}
                        aria-pressed={!!m}
                        aria-label={m ? `${tok}, ${MARK_WORD[m]}` : undefined}
                      >
                        {tok}
                      </button>
                    );
                  })}{' '}
                </span>
              );
            })}
          </p>
        )}
      </InkSurface>

      <footer className="page-foot">
        {chapter > 1 ? (
          <button type="button" onClick={() => go(chapter - 1)} aria-label={`${name} ${chapter - 1}`}>‹ {chapter - 1}</button>
        ) : <span />}
        <span className="translation">World English Bible</span>
        {chapter < chapters ? (
          <button type="button" onClick={() => go(chapter + 1)} aria-label={`${name} ${chapter + 1}`}>{chapter + 1} ›</button>
        ) : <span />}
      </footer>
    </article>
  );
}

function LegalPad({ study, update, ink, setInk, tool, mouseDraws }: {
  study: Study;
  update: (id: string, change: (s: Study) => Study) => void;
  ink: Ink | undefined;
  setInk: (ink: Ink) => void;
  tool: PenTool;
  mouseDraws: boolean;
}) {
  const page = useRef<HTMLTextAreaElement>(null);
  const body = study.notes.page ?? '';
  // The page grows with what is written instead of scrolling inside itself, so ink
  // written beside a line stays beside it.
  useLayoutEffect(() => {
    const t = page.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${Math.max(t.scrollHeight, 0)}px`;
  }, [body]);
  const earlier = SHEETS.filter((s) => s !== 'page' && study.notes[s]?.trim());
  const write = (sheet: Sheet, value: string) => update(study.id, (s) => ({ ...s, notes: { ...s.notes, [sheet]: value } }));

  return (
    <article className="legal-pad" aria-label="Legal pad">
      <div className="binding" aria-hidden="true" />
      <div className="pad-sheet">
        <InkSurface ink={ink} onChange={setInk} tool={tool} mouseDraws={mouseDraws} className="pad-surface">
          <input
            className="pad-title"
            value={study.title}
            placeholder="Title"
            onChange={(e) => update(study.id, (s) => ({ ...s, title: e.target.value }))}
            aria-label="Title"
          />
          <p className="pad-meta">
            {study.passage} · {new Date(study.created).toLocaleDateString(undefined, { dateStyle: 'long' })}
          </p>
          <textarea
            ref={page}
            className="pad-lines"
            value={body}
            onChange={(e) => write('page', e.target.value)}
            aria-label="Notes"
            rows={22}
          />
          {/* The same writing for print: a text box cannot break across pages, so the
              browser moved it whole to the next sheet and stranded the title. */}
          <div className="pad-lines print-text" aria-hidden="true">{body}</div>
          {earlier.map((s) => (
            <Fragment key={s}>
              <p className="pad-heading">{OLD_SHEETS[s]}</p>
              <textarea className="pad-lines short" value={study.notes[s]} onChange={(e) => write(s, e.target.value)} aria-label={OLD_SHEETS[s]} />
            </Fragment>
          ))}
        </InkSurface>
      </div>
    </article>
  );
}

function PenCup({ tool, setTool, undo, canUndo, mouseDraws, setMouseDraws }: {
  tool: PenTool;
  setTool: (t: PenTool) => void;
  undo: () => void;
  canUndo: boolean;
  mouseDraws: boolean;
  setMouseDraws: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = tool === 'eraser' ? 'Eraser' : TOOL_STYLE[tool].label;
  const choose = (t: PenTool) => {
    setTool(t);
    setOpen(false);
  };
  return (
    <div className={`pen-cup${open ? ' open' : ''}`}>
      {open && (
        <div className="pen-choices" role="group" aria-label="Pens">
          {TOOLS.filter((t) => t !== 'pencil').map((t) => (
            <button key={t} type="button" aria-pressed={tool === t} onClick={() => choose(t)}>
              <span className={`nib nib-${t}`} aria-hidden="true" />
              {TOOL_STYLE[t].label}
            </button>
          ))}
          <button type="button" aria-pressed={tool === 'eraser'} onClick={() => choose('eraser')}>
            <span className="nib nib-eraser" aria-hidden="true" />
            Eraser
          </button>
          {/* Only on a mouse or trackpad: an Apple Pencil always writes, fingers never do. */}
          <label className="mouse-writes">
            <input type="checkbox" checked={mouseDraws} onChange={(e) => setMouseDraws(e.target.checked)} /> Write with the mouse
          </label>
        </div>
      )}
      <div className="cup-row">
        <button type="button" className="undo" onClick={undo} disabled={!canUndo} aria-label="Undo">↶</button>
        <button type="button" className="cup" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Pen: ${label}. Change`}>
          <span className={`nib nib-${tool}`} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
