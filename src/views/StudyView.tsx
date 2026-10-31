import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { BY_CODE } from '../lib/books';
import { inkBottom, TOOL_STYLE } from '../lib/ink';
import { coversExactly, LAYOUT, loadLayout, spoken, type ChapterLayout, type Part } from '../lib/layout';
import { useMediaQuery } from '../lib/media';
import { keepReferences, MAX_REFERENCES, savedReferences, type Reference } from '../lib/reference';
import { chapterOf, key, parsePassage, verseOf, type Lengths, type Passage, type VerseKey } from '../lib/refs';
import { href } from '../lib/route';
import { nextMark, SHEETS, type Ink, type Mark, type Sheet, type Study, type Tool } from '../lib/studies';
import { loadBook } from '../lib/text';
import Fit from './Fit';
import InkSurface from './Ink';
import { ReferencePicker, ReferenceText } from './Reference';
import { useScrollLock } from './scrollLock';
import VersePanel from './VersePanel';

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

/** Per-device preferences: kept in the browser, lost harmlessly if storage is blocked. */
const pref = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* the preference lasts until the page closes */
    }
  },
};
/** "write" or "type": how the notes take input on this device. */
const NOTES_MODE_KEY = 'workshop:notes-mode';
/** Set once a Pencil has been used here; from then on fingers scroll, not write. */
const PENCIL_KEY = 'workshop:pencil';
/** "0" when the reader has unlocked the Bible and references from each other. */
const LOCK_KEY = 'workshop:scroll-lock';

/**
 * The widths the Bible's and the notes' text are laid out at. Ink is stored against
 * these; a narrower column shows them scaled down (see Fit), never rewrapped.
 */
const BIBLE_W = 560;
const NOTES_W = 460;

/**
 * A study: the Bible and the notes, each in its own pane that scrolls on its own, and
 * a toolbar floating over both. The screen itself never scrolls. Side by side when
 * there is room; the notes under the Bible on an upright iPad; a tap apart on a phone.
 *
 * References (other translations, commentaries) open in columns beside the Bible, and
 * the notes stay where they are: the reader asked to be able to take notes at all
 * times. The Bible and the notes shrink as a whole to make room, so the ink on them
 * stays on its words. On a phone every pane is a tab.
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
  // How the book is set: paragraphs, poetry. Null while loading; "failed" sets it plain.
  const [layout, setLayout] = useState<ChapterLayout[] | 'failed' | null>(null);
  // On a laptop the mouse starts as a pointer; on an iPad the Pencil starts as a pen.
  const [choice, setChoice] = useState<Choice>(() => (fine() ? 'read' : 'pen'));
  // Which pane a phone shows: "bible", "notes" or a reference's id.
  const [pane, setPane] = useState('bible');
  const [references, setReferences] = useState<Reference[]>(savedReferences);
  const [locked, setLocked] = useState(() => pref.get(LOCK_KEY) !== '0');
  // How far the Bible is shrunk to make room, so references can match its size.
  const [bibleScale, setBibleScale] = useState(1);
  const [jump, setJump] = useState(false);
  const [comparing, setComparing] = useState(false);
  // The verse opened by tapping its number, if any.
  const [opened, setOpened] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState<'write' | 'type'>(() => (pref.get(NOTES_MODE_KEY) === 'type' ? 'type' : 'write'));
  const [pencil, setPencil] = useState(() => pref.get(PENCIL_KEY) === '1');
  const phone = useMediaQuery('(max-width: 599px)');
  // What each change of ink replaced, newest last, so Undo can put it back.
  const [history, setHistory] = useState<{ surface: string; before: Ink | undefined }[]>([]);
  const biblePane = useRef<HTMLElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  useScrollLock(workspace, locked && references.length > 0);

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
    setLayout(null);
    loadLayout(passage.book).then(
      (l) => live && setLayout(l),
      () => live && setLayout('failed'),
    );
    return () => {
      live = false;
    };
  }, [passage?.book]); // eslint-disable-line react-hooks/exhaustive-deps -- the book is all that matters

  // A new chapter starts at its top, as turning a page does, and closes an opened verse.
  useEffect(() => {
    biblePane.current?.scrollTo({ top: 0 });
    setOpened(null);
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
  const setRefs = (next: Reference[]) => {
    setReferences(next);
    keepReferences(next);
  };
  const close = (r: Reference) => {
    setRefs(references.filter((x) => x.id !== r.id));
    if (pane === r.id) setPane('bible');
  };
  // Choosing an open reference closes it; choosing another opens it beside the rest.
  const compare = (r: Reference) => {
    if (references.some((x) => x.id === r.id)) close(r);
    else if (references.length < MAX_REFERENCES) {
      setRefs([...references, r]);
      setPane(r.id);
    }
    setComparing(false);
  };
  const closeVerse = () => setOpened(null);
  const lock = () => {
    setLocked(!locked);
    pref.set(LOCK_KEY, locked ? '0' : '1');
  };
  const front = pane === 'bible' || pane === 'notes' || references.some((r) => r.id === pane) ? pane : 'bible';
  const tabs = [{ id: 'bible', label: 'Bible' }, ...references.map((r) => ({ id: r.id, label: r.short })), { id: 'notes', label: 'Notes' }];
  // The Pencil always writes with the chosen tool ("read" leaves it on the pen). A mouse
  // writes only on a laptop with a pen chosen: on an iPad the default tool is the pen,
  // and a trackpad (Magic Keyboard) would otherwise draw instead of tapping words.
  const tool = choice === 'read' ? 'pen' : choice;
  const onPen = () => {
    if (pencil) return;
    setPencil(true);
    pref.set(PENCIL_KEY, '1');
  };
  const pen = { tool, mouseDraws: fine() && choice !== 'read', onPen };
  const writeNotes = notesMode === 'write';
  // The notes, when for writing, take every pointer: nothing there needs a click.
  // Fingers stop once a Pencil has been used, as Apple Notes does, so a palm resting
  // on the glass leaves no marks.
  const notesPen = { ...pen, mouseDraws: writeNotes || pen.mouseDraws, fingerDraws: writeNotes && !pencil };
  const chooseNotesMode = (m: 'write' | 'type') => {
    setNotesMode(m);
    pref.set(NOTES_MODE_KEY, m);
  };

  return (
    <div ref={workspace} className={`workspace${references.length ? ' has-ref' : ''}`} style={{ '--bible-scale': bibleScale } as CSSProperties}>
      {phone && (
        <div className="pane-switch">
          <div className="pane-tabs" role="tablist" aria-label="Show">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={front === t.id} onClick={() => setPane(t.id)}>{t.label}</button>
            ))}
          </div>
        </div>
      )}

      <section ref={biblePane} className={`pane bible-pane${front === 'bible' ? ' front' : ''}`} role="region" aria-label="Bible">
        <Fit width={BIBLE_W} gutter={20} on={!phone} onScale={setBibleScale}>
          <BibleText
            key={ch} passage={passage} chapter={ch} name={name} book={book} marks={study.marks} onMark={mark}
            layout={layout === 'failed' ? 'failed' : layout?.[ch - 1] ?? null}
            onVerse={(v) => { setOpened(v); setComparing(false); setJump(false); }}
            ink={study.ink?.[`bible:${ch}`]} setInk={setInk(`bible:${ch}`)} {...pen}
          />
        </Fit>
      </section>

      {references.length > 0 && (
        <div className="refs">
          {references.map((r) => (
            <section key={r.id} className={`pane ref-pane${front === r.id ? ' front' : ''}`} role="region" aria-label={r.name}>
              <ReferenceText reference={r} book={passage.book} bookName={name} chapter={ch} close={() => close(r)} />
            </section>
          ))}
        </div>
      )}

      <section className={`pane notes-pane${front === 'notes' ? ' front' : ''}`} role="region" aria-label="Your notes">
        <Fit width={NOTES_W} gutter={16} on={!phone}>
          <Notes study={study} update={update} ink={study.ink?.pad} setInk={setInk('pad')} mode={notesMode} setMode={chooseNotesMode} {...notesPen} />
        </Fit>
      </section>

      {/* Print only, for "Print with lines to write on". */}
      <div className="print-lines" aria-hidden="true">
        {Array.from({ length: 36 }, (_, i) => <span key={i} />)}
      </div>

      {comparing && <ReferencePicker open={references} choose={compare} />}

      {opened !== null && lengths && (
        <VersePanel start={{ book: passage.book, chapter: ch, verse: opened }} lengths={lengths} open={references} close={closeVerse} />
      )}

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
        {references.length > 0 && !phone && (
          <button
            type="button" className="tb-icon tb-lock" onClick={lock} aria-pressed={locked} aria-label="Scroll together"
            title={locked ? 'Scrolling together: the Bible and references keep to the same verse' : 'Scrolling separately'}
          >
            {/* A chain: links joined when locked, broken when not. */}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {locked ? (
                <path d="M9.5 14.5l5-5M8 11l-2 2a3.5 3.5 0 0 0 5 5l2-2M16 13l2-2a3.5 3.5 0 0 0-5-5l-2 2" />
              ) : (
                <path d="M8 11l-2 2a3.5 3.5 0 0 0 5 5l1-1M16 13l2-2a3.5 3.5 0 0 0-5-5l-1 1M4 4l3 3M20 20l-3-3" />
              )}
            </svg>
          </button>
        )}
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

function BibleText({ passage, chapter, name, book, layout, marks, onMark, onVerse, ink, setInk, tool, mouseDraws, onPen }: {
  passage: Passage;
  chapter: number;
  name: string;
  book: Book;
  /** This chapter's setting; null while it loads, "failed" if it couldn't be. */
  layout: ChapterLayout | 'failed' | null;
  marks: Record<string, Mark>;
  onMark: (k: VerseKey, i: number) => void;
  /** Opens a verse: its cross-references and commentary. */
  onVerse: (verse: number) => void;
  ink: Ink | undefined;
  setInk: (ink: Ink) => void;
  tool: Tool | 'eraser';
  mouseDraws: boolean;
  onPen: () => void;
}) {
  const inStudy = (k: VerseKey) => k >= passage.start && k <= passage.end;
  // A study of whole chapters needs no emphasis; a few verses within a chapter are set
  // off from the verses around them, which stay on the page for context.
  const wholeChapters =
    book.state === 'ready' &&
    verseOf(passage.start) === 1 &&
    verseOf(passage.end) === book.text[chapterOf(passage.end) - 1].length;

  const verses = book.state === 'ready' ? book.text[chapter - 1] : [];
  // Ink written before chapters were set in paragraphs (no layout recorded) keeps the
  // continuous setting it was written on: a paragraph break moves every word after it,
  // and the ink would float over the wrong words. Erasing it all frees the chapter.
  const oldInk = !!ink?.strokes.length && ink.layout !== LAYOUT;
  const set = layout && layout !== 'failed' && !oldInk && coversExactly(layout, verses) ? layout : null;
  // Ink written from here on records the setting it was written on.
  const write = (next: Ink) => setInk(set ? { ...next, layout: LAYOUT } : next);

  const word = (k: VerseKey, at: number, tok: string, wj: boolean) => {
    const m = marks[`${k}:${at}`];
    return (
      <button
        type="button"
        className={`word${m ? ` mark-${m}` : ''}${wj ? ' wj' : ''}`}
        onClick={() => onMark(k, at)}
        aria-pressed={!!m}
        aria-label={m ? `${tok}, ${MARK_WORD[m]}` : undefined}
      >
        {tok}
      </button>
    );
  };
  const number = (v: number) =>
    v === 1 ? (
      // The chapter numeral stands where verse 1's number would, and opens it.
      <button type="button" className="drop" onClick={() => onVerse(1)} aria-label="Verse 1">{chapter}</button>
    ) : (
      <sup className="vn">
        <button type="button" className="vn-open" onClick={() => onVerse(v)} aria-label={`Verse ${v}`}>{v}</button>
      </sup>
    );
  // One verse's words from..to, as set in a paragraph or line. Only a verse's first part
  // carries its number and "v" (and data-verse, for scrolling together).
  const part = ([v, from, to]: Part) => {
    const k = key(chapter, v);
    const ws = verses[v - 1].split(/\s+/).filter(Boolean);
    return (
      <span key={`${v}:${from}`} className={`v-part${from === 0 ? ' v' : ''}${inStudy(k) ? ' in-study' : ''}`} data-verse={from === 0 ? v : undefined}>
        {from === 0 && number(v)}
        {ws.slice(from, to).map((tok, j) => (
          <Fragment key={j}>
            {word(k, from + j, tok, !!set && spoken(set, v, from + j))}{' '}
          </Fragment>
        ))}
      </span>
    );
  };

  return (
    <div className="bible-col">
      <p className="book-name">{name}</p>
      <InkSurface ink={ink} onChange={write} tool={tool} mouseDraws={mouseDraws} onPen={onPen} className="bible-text">
        {book.state === 'loading' || (layout === null && !oldInk) ? (
          <p className="quiet">Opening {name}…</p>
        ) : book.state === 'failed' ? (
          <p className="error" role="alert">{name} couldn’t be opened: {book.message}</p>
        ) : set ? (
          <div className={`scripture typeset${wholeChapters ? '' : ' partial'}${ink?.strokes.length ? ' inked' : ''}`}>
            {set.blocks.map((b, bi) =>
              b[0] === 'h' ? (
                <p key={bi} className={`blk-h blk-h-${b[1]}`}>{b[2] as string}</p>
              ) : b[0] === 'b' ? (
                <div key={bi} className="blk-b" aria-hidden="true" />
              ) : (
                <p key={bi} className={`blk blk-${b[0]}`}>{(b[1] as Part[]).map(part)}</p>
              ),
            )}
          </div>
        ) : (
          <p className={`scripture${wholeChapters ? '' : ' partial'}${ink?.strokes.length ? ' inked' : ''}`}>
            {verses.map((text, vi) => {
              const k = key(chapter, vi + 1);
              let i = -1;
              return (
                <span key={k} className={`v-part v${inStudy(k) ? ' in-study' : ''}`} data-verse={vi + 1}>
                  {number(vi + 1)}
                  {text.split(/(\s+)/).map((tok, ti) => {
                    if (/^\s*$/.test(tok)) return <Fragment key={ti}>{tok}</Fragment>;
                    i++;
                    return <Fragment key={ti}>{word(k, i, tok, false)}</Fragment>;
                  })}{' '}
                </span>
              );
            })}
          </p>
        )}
      </InkSurface>
      {oldInk && <p className="translation set-note">Set as it was when you wrote on it</p>}
      {layout === 'failed' && !oldInk && <p className="translation set-note">Set without paragraphs: the layout couldn’t be loaded</p>}
      <p className="translation">World English Bible</p>
    </div>
  );
}

function Notes({ study, update, ink, setInk, mode, setMode, ...pen }: {
  study: Study;
  update: (id: string, change: (s: Study) => Study) => void;
  ink: Ink | undefined;
  setInk: (ink: Ink) => void;
  mode: 'write' | 'type';
  setMode: (m: 'write' | 'type') => void;
  tool: Tool | 'eraser';
  mouseDraws: boolean;
  fingerDraws: boolean;
  onPen: () => void;
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
  // While writing, the typed text can be read but not edited. iPadOS turns Pencil
  // writing over any editable field into typed text (Scribble), and a finger tap on
  // one raises the keyboard; a read-only page gives neither anything to act on. The
  // same elements stay in place, so typed text and ink keep their positions.
  const writing = mode === 'write';
  const inkLow = inkBottom(ink);

  return (
    <div className="notes-col">
      <div className="notes-mode" role="group" aria-label="Notes by">
        <button type="button" aria-pressed={writing} onClick={() => setMode('write')}>Write</button>
        <button type="button" aria-pressed={!writing} onClick={() => setMode('type')}>Type</button>
      </div>
      <InkSurface
        ink={ink} onChange={setInk} {...pen} className={`pad-surface${writing ? ' writing' : ''}`}
        // Room to keep writing below the lowest line written, about ten lines' worth.
        style={inkLow ? { minHeight: inkLow + 320 } : undefined}
      >
        <input
          className="pad-title"
          value={study.title}
          placeholder="Title"
          readOnly={writing}
          tabIndex={writing ? -1 : undefined}
          onChange={(e) => update(study.id, (s) => ({ ...s, title: e.target.value }))}
          aria-label="Title"
        />
        <p className="pad-meta">
          {study.passage} · {new Date(study.created).toLocaleDateString(undefined, { dateStyle: 'long' })}
        </p>
        <textarea
          ref={page} className="pad-lines" value={body} onChange={(e) => write('page', e.target.value)} aria-label="Notes" rows={18}
          readOnly={writing} tabIndex={writing ? -1 : undefined}
          placeholder={writing ? (ink?.strokes.length ? '' : 'Write here with a Pencil, a finger or the mouse…') : 'Type here…'}
        />
        {/* The same writing for print: a text box cannot break across pages, so the
            browser moved it whole to the next sheet and stranded the title. */}
        <div className="pad-lines print-text" aria-hidden="true">{body}</div>
        {earlier.map((s) => (
          <Fragment key={s}>
            <p className="pad-heading">{OLD_SHEETS[s]}</p>
            <textarea className="pad-lines short" value={study.notes[s]} onChange={(e) => write(s, e.target.value)} aria-label={OLD_SHEETS[s]} readOnly={writing} tabIndex={writing ? -1 : undefined} />
          </Fragment>
        ))}
      </InkSurface>
    </div>
  );
}
