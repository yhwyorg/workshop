import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { bibleKey } from '../lib/bible';
import { BY_CODE, shortName } from '../lib/books';
import { inkBottom, TOOL_STYLE } from '../lib/ink';
import { coversExactly, LAYOUT, loadLayout, spoken, type ChapterLayout, type Part } from '../lib/layout';
import { useMediaQuery } from '../lib/media';
import type { PenKind } from '../lib/skin';
import { keepReferences, MAX_REFERENCES, savedReferences, type Reference } from '../lib/reference';
import { chapterOf, key, parsePassage, verseOf, type Lengths, type Passage, type VerseKey } from '../lib/refs';
import { href } from '../lib/route';
import {
  nextMark, notePageBlank, notePageCount, notePageSurface, notePageText, SHEETS, withNewNotePage, withNotePageText, withoutNotePage,
  type Bible, type BookMarks, type Ink, type Mark, type Sheet, type Study, type Tool,
} from '../lib/studies';
import { loadBook } from '../lib/text';
import Fit from './Fit';
import NotesEdge from './NotesEdge';
import { drag, onScreen } from './drag';
import { FountainPen, MultiColourPen, PEN_PHOTO } from './PenArt';
import InkSurface from './Ink';
import { ReferencePicker, ReferenceText } from './Reference';
import { testament } from '../lib/xref';
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
/** Set once a Pencil has been used here; from then on fingers scroll, not write. */
const PENCIL_KEY = 'workshop:pencil';
/** The notepad's size, as the reader left it: width beside the Bible, height below it. */
const NOTES_WIDTH_KEY = 'workshop:notes-width';
const NOTES_HEIGHT_KEY = 'workshop:notes-height';
const NO_MARKS: Record<string, Mark> = {};
/** The page of notes each study was left on: { studyId: page }. */
const NOTES_PAGE_KEY = 'workshop:notes-page';
/** "1" when the margin beside the Bible is open. */
const MARGIN_KEY = 'workshop:margin';
/** "1" when the notepad is folded away. */
const FOLDED_KEY = 'workshop:notes-folded';
const sizePref = (k: string) => {
  const n = Number(pref.get(k));
  return Number.isFinite(n) && n > 0 ? n : null;
};
/** Where the reader moved the toolbar, and laid the pen: {x, y} in pixels, or none. */
const BAR_SPOT_KEY = 'workshop:toolbar-spot';
/** "1" when the toolbar is tucked away to a small button. */
const BAR_TUCKED_KEY = 'workshop:toolbar-tucked';
const TUCKED_SPOT_KEY = 'workshop:toolbar-tucked-spot';
const PEN_SPOT_KEY = 'workshop:pen-spot';
/** Where something lies: its top-left, and for the pen the angle it lies at (degrees). */
type Spot = { x: number; y: number; a?: number };
/** The angle a pen lies at when first laid down: a little askew, as a pen put down is. */
const LAID_ANGLE = -7;
const spotPref = (k: string): Spot | null => {
  try {
    const v = JSON.parse(pref.get(k) ?? 'null') as Spot | null;
    return v && Number.isFinite(v.x) && Number.isFinite(v.y) ? v : null;
  } catch {
    return null;
  }
};
const keepSpot = (k: string, s: Spot | null) => pref.set(k, s ? JSON.stringify(s) : '');
/** The pen laid on the page is larger than in the toolbar, nearer its real size. */
const LOOSE_W = 330;
/** "0" when the reader has unlocked the Bible and references from each other. */
const LOCK_KEY = 'workshop:scroll-lock';

/**
 * The widths the Bible's and the notes' text are laid out at. Ink is stored against
 * these; a narrower column shows them scaled down (see Fit), never rewrapped.
 */
const BIBLE_W = 560;
// The margin is added to the page rather than taken from the text, so no line of the
// text rewraps: the page as a whole is scaled to fit, and ink stays on its words.
const MARGIN_W = 180;
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
export default function StudyView({ study, lengths, update, bible, updateBible, openMenu, pens = PENS, penArt = 'none' }: {
  study: Study | undefined;
  lengths: Lengths | null;
  update: (id: string, change: (s: Study) => Study) => void;
  /** The reader's own Bible: marks and ink on the text, shared by every study (bible.ts). */
  bible: Bible | undefined;
  updateBible: (book: string, change: (b: BookMarks) => BookMarks) => void;
  openMenu: () => void;
  /** The pens the paper style offers, in order (see pensOf). */
  pens?: Tool[];
  /** The paper style's pen, drawn in the toolbar instead of its colours' dots. */
  penArt?: PenKind;
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
  // Looking up: a tap anywhere in a verse opens it (its Greek or Hebrew first), by finger,
  // mouse or Pencil. Asked for older pastors: a verse number is a small target, and a
  // Pencil tap on one writes. Choosing a pen ends it, so the pen does what it says.
  const [looking, setLooking] = useState(false);
  const choose = (c: Choice) => {
    setChoice(c);
    setLooking(false);
  };
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
  const [notesMode, setNotesMode] = useState<'write' | 'type'>('write');
  const [pencil, setPencil] = useState(() => pref.get(PENCIL_KEY) === '1');
  const phone = useMediaQuery('(max-width: 599px)');
  // Keep in step with the toolbar's own narrow rules in index.css.
  const narrowBar = useMediaQuery('(max-width: 1099px)');
  const upright = useMediaQuery('(max-width: 999px)') && !phone;
  const [notesWidth, setNotesWidth] = useState(() => sizePref(NOTES_WIDTH_KEY));
  const [notesHeight, setNotesHeight] = useState(() => sizePref(NOTES_HEIGHT_KEY));
  const [folded, setFolded] = useState(() => pref.get(FOLDED_KEY) === '1');
  const [marginOpen, setMarginOpen] = useState(() => pref.get(MARGIN_KEY) === '1');
  const [notesPage, setNotesPage] = useState(1);
  const leftOn = () => {
    try {
      return JSON.parse(pref.get(NOTES_PAGE_KEY) ?? '{}') as Record<string, number>;
    } catch {
      return {};
    }
  };
  const turnTo = (page: number) => {
    setNotesPage(page);
    if (study) pref.set(NOTES_PAGE_KEY, JSON.stringify({ ...leftOn(), [study.id]: page }));
  };
  const chooseMargin = (on: boolean) => {
    setMarginOpen(on);
    pref.set(MARGIN_KEY, on ? '1' : '0');
  };
  const [fullSpot, setFullSpot] = useState(() => spotPref(BAR_SPOT_KEY));
  // Tucked away, the small button has a place of its own. Sharing one, a button parked at
  // the far edge would open the whole toolbar from there, off the screen.
  const [tucked, setTucked] = useState(() => pref.get(BAR_TUCKED_KEY) === '1');
  const [tuckedSpot, setTuckedSpot] = useState(() => spotPref(TUCKED_SPOT_KEY));
  const barSpot = tucked ? tuckedSpot : fullSpot;
  const setBarSpot = tucked ? setTuckedSpot : setFullSpot;
  const barSpotKey = tucked ? TUCKED_SPOT_KEY : BAR_SPOT_KEY;
  const [penSpot, setPenSpot] = useState(() => spotPref(PEN_SPOT_KEY));
  const toolbar = useRef<HTMLDivElement>(null);
  // Re-rendered when the window changes size, so a moved toolbar or pen stays on screen.
  const [, setViewport] = useState(0);
  useEffect(() => {
    const on = () => setViewport((n) => n + 1);
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);
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
    setNotesPage(study ? leftOn()[study.id] ?? 1 : 1);
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

  // A study of a few verses opens at them. At the chapter's top, the first thing on screen
  // was the dimmed verses around the reading (Luke 2:41-52 opened 40 verses early), with
  // nothing to say the reading was further down. Once per study, so it never fights the
  // reader's own scrolling.
  const placed = useRef<string | null>(null);
  const textReady = book.state === 'ready' && layout !== null;
  useEffect(() => {
    if (!study || !passage || !textReady || chapter !== chapterOf(passage.start) || placed.current === study.id) return;
    placed.current = study.id;
    const verse = verseOf(passage.start);
    if (verse === 1) return;
    // Tried until it holds, for up to two seconds: until Fit has measured the text the pane
    // is too short to scroll that far, and how long that takes varies (a fixed two frames
    // missed on an iPad size, leaving the reading off screen). Timers, not frames, as frames
    // can stall. Two checks in place in a row, so the reader's own scrolling isn't fought.
    let tries = 0;
    let held = 0;
    const timer = setInterval(() => {
      const pane = biblePane.current;
      const at = pane?.querySelector(`[data-verse="${verse}"]`);
      if (!pane || !at) return;
      const off = at.getBoundingClientRect().top - pane.getBoundingClientRect().top - 24;
      if (Math.abs(off) > 2) {
        held = 0;
        pane.scrollTo({ top: pane.scrollTop + off });
      } else held++;
      if (held >= 2 || ++tries >= 40) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [study?.id, chapter, textReady]); // eslint-disable-line react-hooks/exhaustive-deps -- the passage follows the study

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

  // Ink on the Bible ("bible:15") is in the reader's Bible, shared by every study of the
  // chapter, unless this study still holds its own: ink written on another setting of
  // the text, which bible.ts leaves here rather than over the wrong words.
  const mine = bible?.[passage.book];
  const inBible = (surface: string) => !!bibleKey(surface) && !study.ink?.[surface];
  const inkOf = (surface: string) => (inBible(surface) ? mine?.ink[bibleKey(surface)!] : study.ink?.[surface]);
  const putInk = (surface: string, ink: Ink | undefined) => {
    if (inBible(surface)) {
      const at = bibleKey(surface)!;
      updateBible(passage.book, (b) => {
        const next = { ...b.ink };
        if (ink) next[at] = ink;
        else delete next[at];
        return { ...b, ink: next };
      });
    } else {
      update(study.id, (s) => {
        const next = { ...s.ink };
        if (ink) next[surface] = ink;
        else delete next[surface];
        return { ...s, ink: next };
      });
    }
  };
  const setInk = (surface: string) => (ink: Ink) => {
    setHistory((h) => [...h.slice(-49), { surface, before: inkOf(surface) }]);
    putInk(surface, ink);
  };
  const undo = () => {
    const last = history.at(-1);
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    putInk(last.surface, last.before);
    // Undoing on a page out of sight would look like nothing happening.
    const onPage = /^pad(?::(\d+))?$/.exec(last.surface);
    if (onPage) turnTo(Number(onPage[1] ?? 1));
  };
  const mark = (k: VerseKey, i: number) =>
    updateBible(passage.book, (b) => {
      const id = `${k}:${i}`;
      const next = nextMark(b.marks[id]);
      const marks = { ...b.marks };
      if (next) marks[id] = next;
      else delete marks[id];
      return { ...b, marks };
    });

  const name = BY_CODE.get(passage.book)!.name;
  const language = testament(passage.book) === 'old' ? 'Hebrew' : 'Greek';
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
  // The toolbar, dragged by its grip; double-click puts it back at the bottom.
  const moveBar = (e: React.PointerEvent<HTMLElement>) => {
    const r = toolbar.current!.getBoundingClientRect();
    const at = (dx: number, dy: number) => onScreen(r.left + dx, r.top + dy, r.width, r.height);
    drag(e, {
      move: (dx, dy) => setBarSpot(at(dx, dy)),
      end: (moved, ev) => moved && keepSpot(barSpotKey, at(ev.clientX - e.clientX, ev.clientY - e.clientY)),
    });
  };
  const nudgeBar = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 96 : 24;
    const by = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!by) return;
    e.preventDefault();
    const r = toolbar.current!.getBoundingClientRect();
    const next = onScreen(r.left + by[0], r.top + by[1], r.width, r.height);
    setBarSpot(next);
    keepSpot(barSpotKey, next);
  };
  const homeBar = () => {
    setBarSpot(null);
    keepSpot(barSpotKey, null);
  };
  const tuckBar = (on: boolean) => {
    setTucked(on);
    pref.set(BAR_TUCKED_KEY, on ? '1' : '0');
    // Opened from the toolbar, these would be left open with no way to close them.
    setJump(false);
    setComparing(false);
  };
  // The pen, picked up out of the toolbar (or moved where it lies) and laid anywhere.
  // Dropped on the toolbar, it goes back in.
  const penOut = penSpot !== null && penArt !== 'none' && !phone;
  const putPenBack = () => {
    setPenSpot(null);
    keepSpot(PEN_SPOT_KEY, null);
  };
  const carryPen = (e: React.PointerEvent<HTMLElement>, onTap?: () => void) => {
    const r = e.currentTarget.getBoundingClientRect();
    // Held where it was grabbed, as a real pen is: the same point stays under the finger.
    const [fx, fy] = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    const h = (LOOSE_W * r.height) / r.width;
    const at = (ev: PointerEvent) => onScreen(ev.clientX - fx * LOOSE_W, ev.clientY - fy * h, LOOSE_W, h);
    // Keeps the angle it lies at while it is moved.
    const angle = penSpot?.a;
    drag(e, {
      move: (_dx, _dy, ev) => setPenSpot({ ...at(ev), a: angle }),
      end: (moved, ev) => {
        if (!moved) return onTap?.();
        const bar = toolbar.current?.getBoundingClientRect();
        const onBar = bar && ev.clientX >= bar.left && ev.clientX <= bar.right && ev.clientY >= bar.top && ev.clientY <= bar.bottom;
        if (onBar) putPenBack();
        else keepSpot(PEN_SPOT_KEY, { ...at(ev), a: angle });
      },
    });
  };
  // The pen where it lies: grabbed near the middle it moves; grabbed near an end it
  // turns about its middle, to any angle, as a real pen does when one end is pushed.
  const handleLoosePen = (e: React.PointerEvent<HTMLElement>) => {
    if (!penSpot) return;
    const el = e.currentTarget;
    const [w, h] = [el.offsetWidth, el.offsetHeight];
    const c = { x: penSpot.x + w / 2, y: penSpot.y + h / 2 };
    const a0 = penSpot.a ?? LAID_ANGLE;
    const rad = (a0 * Math.PI) / 180;
    // How far along the pen the press is, from its middle (0) to either end (1).
    const along = ((e.clientX - c.x) * Math.cos(rad) + (e.clientY - c.y) * Math.sin(rad)) / (w / 2);
    const tap = penArt === 'fountain' ? () => choose('pen') : undefined;
    if (Math.abs(along) < 0.55) return carryPenFrom(e, w, h, tap);
    const grip = (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI - a0;
    const turned = (ev: PointerEvent) => ({ ...penSpot, a: Math.round((Math.atan2(ev.clientY - c.y, ev.clientX - c.x) * 180) / Math.PI - grip) });
    drag(e, {
      move: (_dx, _dy, ev) => setPenSpot(turned(ev)),
      end: (moved, ev) => (moved ? keepSpot(PEN_SPOT_KEY, turned(ev)) : tap?.()),
    });
  };
  // Moving the pen where it lies: as carrying it, but measured from its unturned box.
  const carryPenFrom = (e: React.PointerEvent<HTMLElement>, w: number, h: number, onTap?: () => void) => {
    if (!penSpot) return;
    const [ox, oy] = [e.clientX - penSpot.x, e.clientY - penSpot.y];
    const angle = penSpot.a;
    const at = (ev: PointerEvent) => ({ ...onScreen(ev.clientX - ox, ev.clientY - oy, w, h), a: angle });
    drag(e, {
      move: (_dx, _dy, ev) => setPenSpot(at(ev)),
      end: (moved, ev) => {
        if (!moved) return onTap?.();
        const bar = toolbar.current?.getBoundingClientRect();
        const onBar = bar && ev.clientX >= bar.left && ev.clientX <= bar.right && ev.clientY >= bar.top && ev.clientY <= bar.bottom;
        if (onBar) putPenBack();
        else keepSpot(PEN_SPOT_KEY, at(ev));
      },
    });
  };
  const fold = (on: boolean) => {
    setFolded(on);
    pref.set(FOLDED_KEY, on ? '1' : '0');
  };
  // Typing goes to the notes, so they come into view: the front tab on a phone, and
  // unfolded elsewhere. Folded, the letters would land on a page no one can see.
  const showNotes = () => {
    setPane('notes');
    if (folded) fold(false);
  };
  const keepSize = (key: string) => (px: number | null) => pref.set(key, px === null ? '' : String(px));
  // The sizes are applied as CSS variables; folded, the layout's own folded sizes rule.
  const sizes = folded || phone ? {} : {
    ...(notesWidth ? { '--notes-size': `${notesWidth}px` } : {}),
    ...(notesHeight ? { '--notes-height': `${notesHeight}px` } : {}),
  };
  const front = pane === 'bible' || pane === 'notes' || references.some((r) => r.id === pane) ? pane : 'bible';
  const tabs = [{ id: 'bible', label: 'Bible' }, ...references.map((r) => ({ id: r.id, label: r.short })), { id: 'notes', label: 'Notes' }];
  // The Pencil always writes with the chosen tool ("read" leaves it on the pen). A mouse
  // writes only on a laptop with a pen chosen: on an iPad the default tool is the pen,
  // and a trackpad (Magic Keyboard) would otherwise draw instead of tapping words.
  const tool = choice === 'read' ? 'pen' : choice;
  // Pens the drawn pen stands for, so they aren't shown twice.
  const drawn: Tool[] = penArt === 'multi-colour' ? pens.filter((t) => t !== 'highlighter') : penArt === 'fountain' ? ['pen'] : [];
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

  return (
    <div
      ref={workspace}
      className={`workspace${references.length ? ' has-ref' : ''}${folded && !phone ? ' notes-folded' : ''}`}
      style={{ '--bible-scale': bibleScale, ...sizes } as CSSProperties}
    >
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
        {/* Sticky and of no height, so the words (and the ink on them) don't move. Before the
            text: placed after it, it only stuck once the chapter's end was reached. */}
        {looking && opened === null && (
          <div className="look-hint-at">
            <p className="look-hint" role="status">Tap a verse to see it in the {language}.</p>
          </div>
        )}
        <Fit width={marginOpen && !phone ? BIBLE_W + MARGIN_W : BIBLE_W} gutter={20} on={!phone} onScale={setBibleScale}>
          <BibleText
            key={ch} passage={passage} chapter={ch} name={name} book={book} marks={mine?.marks ?? NO_MARKS} onMark={mark}
            layout={layout === 'failed' ? 'failed' : layout?.[ch - 1] ?? null}
            onVerse={(v) => { setOpened(v); setComparing(false); setJump(false); }} looking={looking}
            ink={inkOf(`bible:${ch}`)} setInk={setInk(`bible:${ch}`)} {...pen}
            margin={marginOpen && !phone} phone={phone} showMargin={() => chooseMargin(true)} fingerWrites={!pencil}
            marginInk={inkOf(`margin:${ch}`)} setMarginInk={setInk(`margin:${ch}`)}
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

      {!phone && !folded && (
        <NotesEdge
          workspace={workspace} upright={upright}
          size={upright ? notesHeight : notesWidth}
          setSize={upright ? setNotesHeight : setNotesWidth}
          done={keepSize(upright ? NOTES_HEIGHT_KEY : NOTES_WIDTH_KEY)}
        />
      )}

      <section className={`pane notes-pane${front === 'notes' ? ' front' : ''}`} role="region" aria-label="Your notes">
        {/* Beside the Bible a folded notepad is a strip to tap; below it (upright), the
            strip sat under the toolbar and couldn't be tapped, so it unfolds from there. */}
        {!phone && (folded ? (
          !upright && (
            <button type="button" className="notes-unfold" onClick={() => fold(false)} aria-label="Unfold the notepad">
              <span aria-hidden="true">Notes</span>
            </button>
          )
        ) : (
          <button type="button" className="notes-fold" onClick={() => fold(true)} aria-label="Fold the notepad" title="Fold the notepad away">
            {upright ? '⌄' : '›'}
          </button>
        ))}
        <NotesPager study={study} update={update} pageNo={Math.min(notesPage, notePageCount(study))} turnTo={turnTo} forgetUndo={() => setHistory([])} />
        {/* A bigger notepad is a bigger page: it zooms up to nearly twice its size. */}
        <Fit width={NOTES_W} gutter={16} max={1.8} on={!phone}>
          <Notes
            study={study} update={update} pageNo={Math.min(notesPage, notePageCount(study))}
            setInk={setInk} mode={notesMode} setMode={setNotesMode}
            onTyping={showNotes} {...notesPen}
          />
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

      {penOut && penSpot && (
        <img
          className="pen-loose" src={PEN_PHOTO[penArt as keyof typeof PEN_PHOTO]} alt="" draggable={false}
          style={{ left: penSpot.x, top: penSpot.y, width: LOOSE_W, transform: `rotate(${penSpot.a ?? LAID_ANGLE}deg)` }}
          role="button" tabIndex={0}
          aria-label="The pen, lying on the page: drag its middle to move it, an end to turn it; arrow keys turn it; double-click or Enter puts it back"
          title="Drag the middle to move it, an end to turn it"
          onPointerDown={(e) => handleLoosePen(e)}
          onDoubleClick={putPenBack}
          onKeyDown={(e) => {
            if (e.key === 'Enter') return putPenBack();
            const turn = { ArrowLeft: -15, ArrowRight: 15 }[e.key];
            if (turn === undefined || !penSpot) return;
            e.preventDefault();
            const next = { ...penSpot, a: (penSpot.a ?? LAID_ANGLE) + turn };
            setPenSpot(next);
            keepSpot(PEN_SPOT_KEY, next);
          }}
        />
      )}

      <div
        ref={toolbar} className={`toolbar${barSpot ? ' moved' : ''}${tucked ? ' tucked' : ''}`} role="toolbar" aria-label="Study"
        style={barSpot ? (() => {
          const w = toolbar.current?.offsetWidth ?? 0;
          const h = toolbar.current?.offsetHeight ?? 0;
          const s = onScreen(barSpot.x, barSpot.y, w, h);
          return { left: s.x, top: s.y, bottom: 'auto', transform: 'none' };
        })() : undefined}
      >
        <button
          type="button" className="tb-grip" aria-label="Move the toolbar" title="Drag to move the toolbar; double-click to put it back"
          onPointerDown={moveBar} onKeyDown={nudgeBar} onDoubleClick={homeBar}
        >
          <span aria-hidden="true" />
        </button>
        {tucked ? (
          <button type="button" className="tb-open" onClick={() => tuckBar(false)} aria-label="Show the toolbar" title="Show the toolbar">
            <span aria-hidden="true">Tools</span>
            {/* A chevron pointing up: the toolbar rises from here. */}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
          </button>
        ) : (
          <>
          <button type="button" className="tb-icon" onClick={openMenu} aria-label="Menu">
            <span className="tb-menu" aria-hidden="true" />
          </button>
          <span className="tb-sep" aria-hidden="true" />
          <button type="button" className="tb-icon" onClick={() => go(ch - 1)} disabled={ch <= 1} aria-label="Previous chapter">‹</button>
          <button type="button" className="tb-place" onClick={() => { setJump((j) => !j); setComparing(false); }} aria-expanded={jump} aria-label={`${name} ${ch}`}>{narrowBar ? shortName(passage.book) : name} {ch}</button>
          <button type="button" className="tb-icon" onClick={() => go(ch + 1)} disabled={ch >= chapters} aria-label="Next chapter">›</button>
          <button
            type="button" className="tb-icon tb-compare" onClick={() => { setComparing((c) => !c); setJump(false); }} aria-expanded={comparing}
            aria-label="Compare" title="Compare with another translation or a commentary"
          >
            {/* Two columns side by side. */}
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="7" height="14" rx="1.5" /><rect x="13.5" y="5" width="7" height="14" rx="1.5" /></svg>
          </button>
          <button
            type="button" className="tb-look" aria-pressed={looking} onClick={() => setLooking((l) => !l)}
            aria-label={language} title={`Tap a verse to see it in the ${language}`}
          >
            {/* The word where there is room; on narrower screens, its first letters. */}
            <span className="tb-look-letters" aria-hidden="true">{language === 'Greek' ? 'αβ' : 'אב'}</span>
            <span className="tb-look-word" aria-hidden="true">{language}</span>
          </button>
          {/* Not on a phone: there is no room beside the text there. */}
          {!phone && (
            <button
              type="button" className="tb-look tb-margin" aria-pressed={marginOpen} onClick={() => chooseMargin(!marginOpen)}
              aria-label="Margin" title="Open a margin to write in beside the verses"
            >
              {/* A page with a ruled margin down its right side. */}
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3.5" width="16" height="17" rx="2" /><path d="M15 3.5v17M7 8h5M7 12h5M7 16h5" /></svg>
              <span className="tb-look-word" aria-hidden="true">Margin</span>
            </button>
          )}
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
          {upright && folded && (
            <button type="button" className="tb-icon tb-unfold" onClick={() => fold(false)} aria-label="Unfold the notepad" title="Unfold the notepad">
              {/* Ruled lines: the notepad. */}
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M8 8.5h8M8 12h8M8 15.5h5" /></svg>
            </button>
          )}
          <span className="tb-sep tb-pens-sep" aria-hidden="true" />
          <span className="tb-pens" role="group" aria-label="Pens">
            <button type="button" className="tb-icon tb-read" aria-pressed={choice === 'read'} onClick={() => choose('read')} aria-label="Read" title="Read: click words to mark them">
              {/* A pointer arrow; a bare triangle read as a "play" button. */}
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 9-6.2 1.4 3.6 6.6-2.7 1.4-3.6-6.6L5 19z" /></svg>
            </button>
            {/* The paper style's own pen, drawn (PenArt); its colours are its sliders, so
                only the other tools are left as dots beside it. */}
            {penArt === 'multi-colour' && (
              <MultiColourPen
                colours={pens.filter((t) => t !== 'highlighter')} choice={choice} choose={choose}
                out={penOut} pickUp={(e) => carryPen(e)} putBack={putPenBack}
              />
            )}
            {penArt === 'fountain' && (
              <FountainPen pressed={choice === 'pen'} choose={() => choose('pen')} out={penOut} pickUp={(e) => carryPen(e)} putBack={putPenBack} />
            )}
            {pens.filter((t) => !drawn.includes(t)).map((t) => (
              <button key={t} type="button" className="tb-icon" aria-pressed={choice === t} onClick={() => choose(t)} aria-label={TOOL_STYLE[t].label} title={TOOL_STYLE[t].label}>
                <span className={`nib nib-${t}`} aria-hidden="true" />
              </button>
            ))}
            <button type="button" className="tb-icon" aria-pressed={choice === 'eraser'} onClick={() => choose('eraser')} aria-label="Eraser" title="Eraser">
              <span className="nib nib-eraser" aria-hidden="true" />
            </button>
            <button type="button" className="tb-icon" onClick={undo} disabled={!history.length} aria-label="Undo" title="Undo">↶</button>
          </span>
          <button type="button" className="tb-tuck" onClick={() => tuckBar(true)} aria-label="Minimize the toolbar" title="Tuck the toolbar away">
            {/* A chevron pointing down: the toolbar sinks away. */}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          </>
        )}
      </div>
    </div>
  );
}

function BibleText({
  passage, chapter, name, book, layout, marks, onMark, onVerse, looking, ink, setInk, tool, mouseDraws, onPen,
  margin, phone, showMargin, fingerWrites, marginInk, setMarginInk,
}: {
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
  /** A tap on a word opens its verse, rather than marking the word. */
  looking: boolean;
  ink: Ink | undefined;
  setInk: (ink: Ink) => void;
  tool: Tool | 'eraser';
  mouseDraws: boolean;
  onPen: () => void;
  /** The margin is open beside the text. */
  margin: boolean;
  phone: boolean;
  showMargin: () => void;
  /** No Pencil has been seen: a finger writes in the margin, as on the notes. */
  fingerWrites: boolean;
  marginInk: Ink | undefined;
  setMarginInk: (ink: Ink) => void;
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
  const hasMarginNotes = !!marginInk?.strokes.length;

  const word = (k: VerseKey, at: number, tok: string, wj: boolean) => {
    const m = marks[`${k}:${at}`];
    return (
      <button
        type="button"
        className={`word${m ? ` mark-${m}` : ''}${wj ? ' wj' : ''}`}
        onClick={() => (looking ? onVerse(verseOf(k)) : onMark(k, at))}
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
    <div className={`bible-col${margin ? ' with-margin' : ''}`}>
      <div className="bible-main">
        <p className="book-name">{name}</p>
        {/* Notes out of sight must say so: a closed margin would read as notes lost. */}
        {hasMarginNotes && !margin && (
          phone ? (
            <p className="translation set-note margin-note">This chapter has notes in its margin. They show on an iPad or a laptop.</p>
          ) : (
            <p className="margin-note"><button type="button" className="margin-show" onClick={showMargin}>Show your margin notes</button></p>
          )
        )}
        <InkSurface ink={ink} onChange={write} tool={tool} mouseDraws={mouseDraws} writes={!looking} onPen={onPen} className="bible-text">
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
      {/* Nothing here to tap, so everything writes, with no pen to choose first. It has
          no text of its own to keep to the Bible's setting, so its ink is its own. */}
      {margin && (
        <InkSurface
          ink={marginInk} onChange={(next) => setMarginInk({ ...next, layout: LAYOUT })} tool={tool} mouseDraws fingerDraws={fingerWrites && !looking}
          writes={!looking} onPen={onPen} className="bible-margin"
        >
          {!hasMarginNotes && <p className="margin-empty">Write here, beside the verses.</p>}
        </InkSurface>
      )}
    </div>
  );
}

/** The title and date; a notebook skin sets them in its DATE/NO. and TITLE box. */
function PadMeta({ study }: { study: Study }) {
  return (
    <p className="pad-meta">
      <span className="pad-no">{study.passage}</span>
      <span className="pad-sep"> · </span>
      <span className="pad-date">{new Date(study.created).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
    </p>
  );
}

/**
 * Turning, adding and removing pages of notes. Outside the notepad's Fit, so it stays a
 * steady size for the finger: inside, an upright iPad's zoom made it 1.8 times too big, a
 * quarter of the room for writing. Held at the top of the pane, as a long page is where
 * the next one is wanted.
 */
function NotesPager({ study, update, pageNo, turnTo, forgetUndo }: {
  study: Study;
  update: (id: string, change: (s: Study) => Study) => void;
  pageNo: number;
  turnTo: (page: number) => void;
  /** Undo's record names pages by number, and removing a page changes the numbers. */
  forgetUndo: () => void;
}) {
  const pages = notePageCount(study);
  const addPage = () => {
    // A blank last page is already somewhere to write: blanks shouldn't pile up.
    if (notePageBlank(study, pages) && pages > 1) return turnTo(pages);
    update(study.id, withNewNotePage);
    turnTo(pages + 1);
  };
  const removePage = () => {
    if (!notePageBlank(study, pageNo) && !confirm(`Remove Page ${pageNo} and what is written on it? This can’t be undone.`)) return;
    update(study.id, (s) => withoutNotePage(s, pageNo));
    forgetUndo();
    turnTo(Math.min(pageNo, pages - 1));
  };
  return (
    <div className="notes-bar" role="group" aria-label="Pages of notes">
      {pages > 1 && (
        <>
          <button type="button" className="pager-turn" onClick={() => turnTo(pageNo - 1)} disabled={pageNo <= 1} aria-label="Previous page">‹</button>
          <select className="pager-which" aria-label="Which page" value={pageNo} onChange={(e) => turnTo(Number(e.target.value))}>
            {Array.from({ length: pages }, (_, i) => <option key={i} value={i + 1}>Page {i + 1} of {pages}</option>)}
          </select>
          <button type="button" className="pager-turn" onClick={() => turnTo(pageNo + 1)} disabled={pageNo >= pages} aria-label="Next page">›</button>
        </>
      )}
      <button type="button" className="pager-add" onClick={addPage}>Add a page</button>
      {/* The first page stays: it holds the title and date. */}
      {pageNo > 1 && <button type="button" className="pager-remove" onClick={removePage} aria-label="Remove this page">Remove</button>}
    </div>
  );
}

function Notes({ study, update, pageNo, setInk, mode, setMode, onTyping, ...pen }: {
  study: Study;
  update: (id: string, change: (s: Study) => Study) => void;
  /** The page on screen, counted from 1. */
  pageNo: number;
  setInk: (surface: string) => (ink: Ink) => void;
  mode: 'write' | 'type';
  setMode: (m: 'write' | 'type') => void;
  /** Called when typing begins, so a phone shows the notes. */
  onTyping: () => void;
  tool: Tool | 'eraser';
  mouseDraws: boolean;
  fingerDraws: boolean;
  onPen: () => void;
}) {
  const page = useRef<HTMLTextAreaElement>(null);
  const pages = notePageCount(study);
  const body = notePageText(study, pageNo);
  const ink = study.ink?.[notePageSurface(pageNo)];
  const numbers = Array.from({ length: pages }, (_, i) => i + 1);
  // A page turned starts at its top, as a page in a notebook does.
  useEffect(() => {
    page.current?.closest('.pane')?.scrollTo({ top: 0 });
  }, [pageNo]);
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

  // Write or Type without choosing (the user: "auto detect if someone is typing so we
  // don't have to switch"). A key typed while not in a text box switches to typing and
  // lands at the end of the notes; from then on the keys go to the page itself. Keys
  // that belong to something else are left alone: shortcuts, typing in the title or
  // another box, and Space or Enter on a button (Space marks a focused word).
  // The text is kept in a ref while the page catches up: keys typed quickly arrive
  // before the page is focused, and each would otherwise be added to a stale copy,
  // losing all but the last.
  const typed = useRef<string | null>(null);
  const latest = useRef(body);
  latest.current = body;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.key.length !== 1) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (el?.tagName === 'BUTTON' && e.key === ' ') return;
      e.preventDefault();
      typed.current = (typed.current ?? latest.current) + e.key;
      update(study.id, (s) => withNotePageText(s, pageNo, typed.current!));
      setMode('type');
      onTyping();
      requestAnimationFrame(() => {
        typed.current = null;
        const t = page.current;
        if (!t) return;
        t.focus();
        t.setSelectionRange(t.value.length, t.value.length);
      });
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [study.id, pageNo, update, setMode, onTyping]);
  // And back: a Pencil on the notes while typing means writing. The page goes read-only
  // again, so iPadOS can't turn the handwriting into typed text.
  const onPen = () => {
    pen.onPen();
    if (mode === 'type') {
      setMode('write');
      (document.activeElement as HTMLElement | null)?.blur();
    }
  };

  // There is no switch between writing and typing (the user: "take out the write/type
  // options"). A tap asks for the keyboard: a physical one announces itself by typing, but
  // an on-screen one only comes up for a box already chosen, so without this a phone or an
  // iPad with no keyboard could never type. Made editable here and not on the next render:
  // iPad raises its keyboard only for a box that can take text during the tap itself.
  const openKeyboard = (pressed: Element) => {
    const box = (pressed.closest('input, textarea') ?? page.current) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!box) return;
    box.readOnly = false;
    setMode('type');
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  };

  return (
    <div
      className="notes-col"
      onFocus={(e) => e.target.matches('input, textarea') && setMode('type')}
      // Between the title and the notes is still typing.
      onBlur={(e) => !(e.relatedTarget instanceof Element && e.currentTarget.contains(e.relatedTarget) && e.relatedTarget.matches('input, textarea')) && setMode('write')}
    >
      {/* The other pages, for paper only: "Print my notes" means all of them, in order. */}
      {numbers.filter((n) => n < pageNo).map((n) => <PrintedPage key={n} study={study} n={n} />)}
      <InkSurface
        key={pageNo}
        ink={ink} onChange={setInk(notePageSurface(pageNo))} {...pen} onPen={onPen} onTap={writing ? openKeyboard : undefined}
        className={`pad-surface${writing ? ' writing' : ''}`}
        // Room to keep writing below the lowest line written, about ten lines' worth.
        style={inkLow ? { minHeight: inkLow + 320 } : undefined}
      >
        {/* Either way they are three rules tall, so ink below them never moves. */}
        {pageNo === 1 ? (
          <div className="pad-head">
            <span className="pad-label pad-label-date" aria-hidden="true">Date / No.</span>
            <span className="pad-label pad-label-title" aria-hidden="true">Title</span>
            <input
              className="pad-title"
              value={study.title}
              placeholder="Title"
              readOnly={writing}
              onChange={(e) => update(study.id, (s) => ({ ...s, title: e.target.value }))}
              aria-label="Title"
            />
            <PadMeta study={study} />
          </div>
        ) : (
          <p className="pad-page-no">Page {pageNo}</p>
        )}
        <textarea
          ref={page} className="pad-lines" value={body} onChange={(e) => update(study.id, (s) => withNotePageText(s, pageNo, e.target.value))} aria-label="Notes" rows={18}
          readOnly={writing}
          placeholder={writing ? (ink?.strokes.length ? '' : 'Write here, or tap to type…') : 'Type here…'}
        />
        {/* The same writing for print: a text box cannot break across pages, so the
            browser moved it whole to the next sheet and stranded the title. */}
        <div className="pad-lines print-text" aria-hidden="true">{body}</div>
        {pageNo === 1 && earlier.map((s) => (
          <Fragment key={s}>
            <p className="pad-heading">{OLD_SHEETS[s]}</p>
            <textarea className="pad-lines short" value={study.notes[s]} onChange={(e) => write(s, e.target.value)} aria-label={OLD_SHEETS[s]} readOnly={writing} />
          </Fragment>
        ))}
      </InkSurface>
      {numbers.filter((n) => n > pageNo).map((n) => <PrintedPage key={n} study={study} n={n} />)}
    </div>
  );
}

/** A page of notes as paper shows it; on screen, only the page being worked on is drawn. */
function PrintedPage({ study, n }: { study: Study; n: number }) {
  const ink = study.ink?.[notePageSurface(n)];
  const low = inkBottom(ink);
  return (
    <InkSurface
      ink={ink} onChange={() => {}} tool="pen" mouseDraws={false} writes={false} className="pad-surface print-page"
      style={low ? { minHeight: low + 320 } : undefined}
    >
      {n === 1 ? (
        <div className="pad-head">
          <span className="pad-label pad-label-date" aria-hidden="true">Date / No.</span>
          <span className="pad-label pad-label-title" aria-hidden="true">Title</span>
          <div className="pad-title">{study.title}</div>
          <PadMeta study={study} />
        </div>
      ) : (
        <p className="pad-page-no">Page {n}</p>
      )}
      <div className="pad-lines print-text">{notePageText(study, n)}</div>
    </InkSurface>
  );
}
