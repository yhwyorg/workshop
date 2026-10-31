import { Fragment, useEffect, useState } from 'react';
import { SHEETS, exportPad, nextMark, type Mark, type Pad, type Sheet } from '../lib/pads';
import { chapterOf, parsePassage, verseOf, versesIn, type Lengths, type VerseKey } from '../lib/refs';
import { href } from '../lib/route';
import { loadBook } from '../lib/text';

const SHEET_LABEL: Record<Sheet, { name: string; hint: string }> = {
  observe: { name: 'Observe', hint: 'What do you see? Repeated words, the verbs, who is speaking, where and when…' },
  questions: { name: 'Questions', hint: 'What does the text make you ask?' },
  connections: { name: 'Connections', hint: 'Where else does Scripture speak to this?' },
  bigIdea: { name: 'Big idea', hint: 'The text in one sentence.' },
  outline: { name: 'Outline', hint: 'How will the sermon move?' },
  illustrations: { name: 'Illustrations', hint: 'Stories, images, pictures that open the text.' },
  application: { name: 'Application', hint: 'So what, for them and for you?' },
};

const MARK_WORD: Record<Mark, string> = { underline: 'underlined', circle: 'circled', box: 'boxed' };

type Text = { state: 'loading' } | { state: 'ready'; verses: { k: VerseKey; text: string }[] } | { state: 'failed'; message: string };

export default function PadView({ pad, lengths, update, remove }: {
  pad: Pad | undefined;
  lengths: Lengths | null;
  update: (id: string, change: (p: Pad) => Pad) => void;
  remove: (id: string) => void;
}) {
  const [sheet, setSheet] = useState<Sheet>('observe');
  const [text, setText] = useState<Text>({ state: 'loading' });
  const [printing, setPrinting] = useState<'notes' | 'handwriting'>('notes');

  useEffect(() => {
    if (pad) document.title = `${pad.title} · Sermon Workshop`;
  }, [pad]);

  useEffect(() => {
    if (!pad || !lengths) return;
    let live = true;
    try {
      const p = parsePassage(pad.passage, lengths);
      loadBook(p.book).then(
        (book) => live && setText({ state: 'ready', verses: versesIn(p, lengths[p.book]).map((k) => ({ k, text: book[chapterOf(k) - 1][verseOf(k) - 1] })) }),
        (e: Error) => live && setText({ state: 'failed', message: e.message }),
      );
    } catch (e) {
      setText({ state: 'failed', message: (e as Error).message });
    }
    return () => {
      live = false;
    };
  }, [pad?.passage, lengths]); // eslint-disable-line react-hooks/exhaustive-deps -- only the passage changes the text

  useEffect(() => {
    document.body.dataset.print = printing;
  }, [printing]);

  if (!pad) {
    return (
      <p className="paper notice" role="alert">
        This pad isn’t on this desk. Pads live in the browser that made them. <a href={href.desk()}>Back to the desk</a>
      </p>
    );
  }

  const mark = (k: VerseKey, i: number) =>
    update(pad.id, (p) => {
      const id = `${k}:${i}`;
      const next = nextMark(p.marks[id]);
      const marks = { ...p.marks };
      if (next) marks[id] = next;
      else delete marks[id];
      return { ...p, marks };
    });

  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportPad(pad)], { type: 'application/json' }));
    a.download = `${pad.title.replace(/[^\w\s-]/g, '').trim() || 'pad'}.workshop.json`;
    a.click();
  };

  const doPrint = (mode: 'notes' | 'handwriting') => {
    setPrinting(mode);
    // Let the print layout render before the dialog opens.
    requestAnimationFrame(() => requestAnimationFrame(() => print()));
  };

  return (
    <article className="pad-page">
      <div className="pad-tools no-print">
        <a href={href.desk()}>← Desk</a>
        <span className="spacer" />
        <button type="button" onClick={download}>Export</button>
        <button type="button" onClick={() => doPrint('notes')}>Print notes</button>
        <button type="button" onClick={() => doPrint('handwriting')} title="The passage beside ruled lines, on legal paper, to write on by hand">
          Print for handwriting
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            if (confirm(`Throw away “${pad.title}”? This can’t be undone; export it first to keep a copy.`)) {
              remove(pad.id);
              location.hash = href.desk();
            }
          }}
        >
          Throw away
        </button>
      </div>

      <section className="pad">
        <div className="binding" aria-hidden="true" />
        <div className="sheet">
          <input
            className="pad-title hand"
            value={pad.title}
            onChange={(e) => update(pad.id, (p) => ({ ...p, title: e.target.value }))}
            aria-label="Pad title"
          />
          <p className="pad-passage">{pad.passage} <span className="muted">· World English Bible</span></p>

          <div className="slip passage-slip">
            {text.state === 'loading' ? (
              <p className="muted">Opening the text…</p>
            ) : text.state === 'failed' ? (
              <p className="error" role="alert">The text couldn’t be opened: {text.message}</p>
            ) : (
              <Passage verses={text.verses} marks={pad.marks} onMark={mark} />
            )}
            <p className="slip-hint no-print">Tap a word to underline it; tap again to circle it, again to box it.</p>
          </div>

          <div className="sheet-tabs no-print" role="tablist">
            {SHEETS.map((s) => (
              <button key={s} role="tab" aria-selected={sheet === s} className={pad.notes[s]?.trim() ? 'has-notes' : undefined} onClick={() => setSheet(s)}>
                {SHEET_LABEL[s].name}
              </button>
            ))}
          </div>
          <textarea
            className="notes hand no-print"
            value={pad.notes[sheet] ?? ''}
            placeholder={SHEET_LABEL[sheet].hint}
            onChange={(e) => update(pad.id, (p) => ({ ...p, notes: { ...p.notes, [sheet]: e.target.value } }))}
            aria-label={`${SHEET_LABEL[sheet].name} notes`}
            rows={14}
          />

          {/* Print only: every sheet with notes, in order. */}
          <div className="print-notes">
            {SHEETS.filter((s) => pad.notes[s]?.trim()).map((s) => (
              <section key={s}>
                <h2>{SHEET_LABEL[s].name}</h2>
                <p className="hand">{pad.notes[s]}</p>
              </section>
            ))}
          </div>
          <div className="print-lines" aria-hidden="true">
            {Array.from({ length: 34 }, (_, i) => <span key={i} />)}
          </div>
        </div>
      </section>
    </article>
  );
}

function Passage({ verses, marks, onMark }: {
  verses: { k: VerseKey; text: string }[];
  marks: Record<string, Mark>;
  onMark: (k: VerseKey, i: number) => void;
}) {
  return (
    <p className="scripture">
      {verses.map(({ k, text }, vi) => {
        let i = -1;
        const first = vi === 0 || chapterOf(verses[vi - 1].k) !== chapterOf(k);
        return (
          <Fragment key={k}>
            <sup className="vn">{first ? `${chapterOf(k)}:${verseOf(k)}` : verseOf(k)}</sup>
            {text.split(/(\s+)/).map((tok, ti) => {
              if (/^\s*$/.test(tok)) return tok;
              i++;
              const m = marks[`${k}:${i}`];
              const at = i;
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
          </Fragment>
        );
      })}
    </p>
  );
}

