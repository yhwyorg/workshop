import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BY_CODE } from '../lib/books';
import { TOOL_STYLE } from '../lib/ink';
import { useMediaQuery } from '../lib/media';
import { keepReference, savedReference, type Reference } from '../lib/reference';
import { chapterOf, key, parsePassage, verseOf, type Lengths, type Passage, type VerseKey } from '../lib/refs';
import { href } from '../lib/route';
import { nextMark, SHEETS, type Ink, type Mark, type Sheet, type Study, type Tool } from '../lib/studies';
import { loadBook } from '../lib/text';
import InkSurface from './Ink';
import { ReferencePicker, ReferenceText } from './Reference';

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

/** "read" is the pointer: on a laptop it clicks words; a pen tool turns the mouse into that pen. */
type Choice = 'read' | Tool | 'eraser';
const PENS: Tool[] = ['pen', 'red', 'highlighter'];

type Book = { state: 'loading' } | { state: 'ready'; text: string[][] } | { state: 'failed'; message: string };

const fine = () => typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;

/**
 * A study: the Bible and the notes, each in its own pane that scrolls on its own, and
 * a toolbar floating over both. The screen itself never scrolls. Side by side when
 * there is room; the notes under the Bible on an upright iPad; a tap apart on a phone.
 *
 * A reference (another translation, a commentary) gets a pane of its own on a wide
 * screen. Elsewhere it shares the notes' place, a tap away from them, so the Bible's
 * pane keeps its size and the ink written on it stays where it was written.
 */
export default function StudyView({ study, lengths, update, openMenu }: {
  study: Study | undefined;
  lengths: Lengths | null;
  update: (id: string, change: (s: Study) => Study) => void;
  openMenu: () => void;
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
  // On a laptop the mouse starts as a pointer; on an iPad the Pencil starts as a pen.
  const [choice, setChoice] = useState<Choice>(() => (fine() ? 'read' : 'pen'));
  // Which pane is in front where they can't all be: a phone shows one, a laptop or
  // iPad shows the Bible and one of the other two.
  const [pane, setPane] = useState<'bible' | 'notes' | 'ref'>('bible');
  const [reference, setReference] = useState<Reference | null>(savedReference);
  const [jump, setJump] = useState(false);
  const [comparing, setComparing] = useState(false);
  const phone = useMediaQuery('(max-width: 599px)');
  const wide = useMediaQuery('(min-width: 1600px)');
  // What each change of ink replaced, newest last, so Undo can put it back.
  const [history, setHistory] = useState<{ surface: string; before: Ink | undefined }[]>([]);
  const biblePane = useRef<HTMLElement>(null);

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

  // A new chapter starts at its top, as turning a page does.
  useEffect(() => {
    biblePane.current?.scrollTo({ top: 0 });
  }, [chapter]);

  if (!study) {
    return (
      <p className="notice" role="alert">
        This study isn’t on this device. Studies stay in the browser where they were written.{' '}
        <a href={href.studies()}>See your studies</a>
      </p>
    );
  }
  if (!passage) return <p className="notice" role="alert">“{study.passage}” couldn’t be opened.</p>;

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

  const name = BY_CODE.get(passage.book)!.name;
  const chapters = lengths![passage.book].length;
  const ch = chapter ?? chapterOf(passage.start);
  const go = (c: number) => {
    setChapter(c);
    setJump(false);
  };
  const compare = (r: Reference | null) => {
    setReference(r);
    keepReference(r);
    setPane(r ? 'ref' : 'bible');
    setComparing(false);
  };
  // The tabs a reader needs to reach every pane: all three on a phone; on a laptop or
  // iPad, only the notes and the reference that share a place; none on a wide screen.
  const tabs = (phone ? (['bible', 'ref', 'notes'] as const) : reference && !wide ? (['notes', 'ref'] as const) : [])
    .filter((t) => t !== 'ref' || reference);
  const label = { bible: 'Bible', notes: 'Notes', ref: reference?.short ?? '' };
  const front = !phone && pane === 'bible' ? 'notes' : pane;
  // The Pencil always writes with the chosen tool ("read" leaves it on the pen). A mouse
  // writes only on a laptop with a pen chosen: on an iPad the default tool is the pen,
  // and a trackpad (Magic Keyboard) would otherwise draw instead of tapping words.
  const tool = choice === 'read' ? 'pen' : choice;
  const pen = { tool, mouseDraws: fine() && choice !== 'read' };

  return (
    <div className={`workspace show-${front}${reference ? ' has-ref' : ''}`}>
      {tabs.length > 0 && (
        <div className="pane-switch">
          <div className="pane-tabs" role="tablist" aria-label="Show">
            {tabs.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={front === t} onClick={() => setPane(t)}>{label[t]}</button>
            ))}
          </div>
        </div>
      )}

      <section ref={biblePane} className="pane bible-pane" role="region" aria-label="Bible">
        <BibleText key={ch} passage={passage} chapter={ch} name={name} book={book} marks={study.marks} onMark={mark} ink={study.ink?.[`bible:${ch}`]} setInk={setInk(`bible:${ch}`)} {...pen} />
      </section>

      {reference && (
        <section className="pane ref-pane" role="region" aria-label={reference.name}>
          <ReferenceText reference={reference} book={passage.book} bookName={name} chapter={ch} close={() => compare(null)} />
        </section>
      )}

      <section className="pane notes-pane" role="region" aria-label="Your notes">
        <Notes study={study} update={update} ink={study.ink?.pad} setInk={setInk('pad')} {...pen} />
      </section>

      {/* Print only, for "Print with lines to write on". */}
      <div className="print-lines" aria-hidden="true">
        {Array.from({ length: 36 }, (_, i) => <span key={i} />)}
      </div>

      {comparing && <ReferencePicker current={reference} choose={compare} />}

      {jump && (
        <div className="chapter-picker" role="dialog" aria-label={`Chapters of ${name}`}>
          <ol className="chapter-grid">
            {Array.from({ length: chapters }, (_, i) => (
              <li key={i}>
                <button type="button" aria-current={i + 1 === ch ? 'page' : undefined} onClick={() => go(i + 1)}>{i + 1}</button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="toolbar" role="toolbar" aria-label="Study">
        <button type="button" className="tb-icon" onClick={openMenu} aria-label="Menu">
          <span className="tb-menu" aria-hidden="true" />
        </button>
        <span className="tb-sep" aria-hidden="true" />
        <button type="button" className="tb-icon" onClick={() => go(ch - 1)} disabled={ch <= 1} aria-label="Previous chapter">‹</button>
        <button type="button" className="tb-place" onClick={() => { setJump((j) => !j); setComparing(false); }} aria-expanded={jump}>{name} {ch}</button>
        <button type="button" className="tb-icon" onClick={() => go(ch + 1)} disabled={ch >= chapters} aria-label="Next chapter">›</button>
        <button
          type="button" className="tb-icon tb-compare" onClick={() => { setComparing((c) => !c); setJump(false); }} aria-expanded={comparing}
          aria-label="Compare" title="Compare with another translation or a commentary"
        >
          {/* Two columns side by side. */}
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="7" height="14" rx="1.5" /><rect x="13.5" y="5" width="7" height="14" rx="1.5" /></svg>
        </button>
        <span className="tb-sep tb-pens-sep" aria-hidden="true" />
        <span className="tb-pens" role="group" aria-label="Pens">
          <button type="button" className="tb-icon tb-read" aria-pressed={choice === 'read'} onClick={() => setChoice('read')} aria-label="Read" title="Read: click words to mark them">
            {/* A pointer arrow; a bare triangle read as a "play" button. */}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 9-6.2 1.4 3.6 6.6-2.7 1.4-3.6-6.6L5 19z" /></svg>
          </button>
          {PENS.map((t) => (
            <button key={t} type="button" className="tb-icon" aria-pressed={choice === t} onClick={() => setChoice(t)} aria-label={TOOL_STYLE[t].label} title={TOOL_STYLE[t].label}>
              <span className={`nib nib-${t}`} aria-hidden="true" />
            </button>
          ))}
          <button type="button" className="tb-icon" aria-pressed={choice === 'eraser'} onClick={() => setChoice('eraser')} aria-label="Eraser" title="Eraser">
            <span className="nib nib-eraser" aria-hidden="true" />
          </button>
          <button type="button" className="tb-icon" onClick={undo} disabled={!history.length} aria-label="Undo" title="Undo">↶</button>
        </span>
      </div>
    </div>
  );
}

function BibleText({ passage, chapter, name, book, marks, onMark, ink, setInk, tool, mouseDraws }: {
  passage: Passage;
  chapter: number;
  name: string;
  book: Book;
  marks: Record<string, Mark>;
  onMark: (k: VerseKey, i: number) => void;
  ink: Ink | undefined;
  setInk: (ink: Ink) => void;
  tool: Tool | 'eraser';
  mouseDraws: boolean;
}) {
  const inStudy = (k: VerseKey) => k >= passage.start && k <= passage.end;
  // A study of whole chapters needs no emphasis; a few verses within a chapter are set
  // off from the verses around them, which stay on the page for context.
  const wholeChapters =
    book.state === 'ready' &&
    verseOf(passage.start) === 1 &&
    verseOf(passage.end) === book.text[chapterOf(passage.end) - 1].length;

  return (
    <div className="bible-col">
      <p className="book-name">{name}</p>
      <InkSurface ink={ink} onChange={setInk} tool={tool} mouseDraws={mouseDraws} className="bible-text">
        {book.state === 'loading' ? (
          <p className="quiet">Opening {name}…</p>
        ) : book.state === 'failed' ? (
          <p className="error" role="alert">{name} couldn’t be opened: {book.message}</p>
        ) : (
          <p className={`scripture${wholeChapters ? '' : ' partial'}${ink?.strokes.length ? ' inked' : ''}`}>
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
      <p className="translation">World English Bible</p>
    </div>
  );
}

function Notes({ study, update, ink, setInk, tool, mouseDraws }: {
  study: Study;
  update: (id: string, change: (s: Study) => Study) => void;
  ink: Ink | undefined;
  setInk: (ink: Ink) => void;
  tool: Tool | 'eraser';
  mouseDraws: boolean;
}) {
  const page = useRef<HTMLTextAreaElement>(null);
  const body = study.notes.page ?? '';
  // The page grows with what is written instead of scrolling inside itself, so ink
  // written beside a line stays beside it; the pane scrolls instead.
  useLayoutEffect(() => {
    const t = page.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${t.scrollHeight}px`;
  }, [body]);
  const earlier = SHEETS.filter((s) => s !== 'page' && study.notes[s]?.trim());
  const write = (sheet: Sheet, value: string) => update(study.id, (s) => ({ ...s, notes: { ...s.notes, [sheet]: value } }));

  return (
    <div className="notes-col">
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
        <textarea ref={page} className="pad-lines" value={body} onChange={(e) => write('page', e.target.value)} aria-label="Notes" placeholder="Write here…" rows={18} />
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
  );
}
