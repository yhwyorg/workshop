import { useEffect, useRef, useState, type FormEvent } from 'react';
import { importPad, newPad, type Pad } from '../lib/pads';
import { formatPassage, parsePassage, RefError, type Lengths } from '../lib/refs';
import { href } from '../lib/route';

export default function Desk({ pads, lengths, add }: { pads: Pad[]; lengths: Lengths | null; add: (p: Pad) => void }) {
  const [passage, setPassage] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Sermon Workshop';
  }, []);

  const start = (e: FormEvent) => {
    e.preventDefault();
    if (!lengths) return setError('The Bible text is still loading. Try again in a moment.');
    try {
      const p = formatPassage(parsePassage(passage, lengths));
      const pad = newPad(p, title.trim() || p);
      add(pad);
      location.hash = href.pad(pad.id);
    } catch (err) {
      if (!(err instanceof RefError)) throw err;
      setError(err.message);
    }
  };

  const open = async (f: File | undefined) => {
    if (!f) return;
    try {
      const pad = importPad(await f.text());
      add(pad);
      location.hash = href.pad(pad.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="desk-page">
      <section className="pad start">
        <div className="binding" aria-hidden="true" />
        <div className="sheet">
          <h1 className="hand">Start a pad</h1>
          <form onSubmit={start} className="start-form">
            <label>
              <span>Passage</span>
              <input
                value={passage}
                onChange={(e) => {
                  setPassage(e.target.value);
                  setError(null);
                }}
                placeholder="John 15:1-11"
                autoComplete="off"
                spellCheck={false}
                required
              />
            </label>
            <label>
              <span>Title (optional)</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Remain in me" />
            </label>
            <button type="submit">Open a fresh pad</button>
          </form>
          {error && <p className="error" role="alert">{error}</p>}
          <p className="small muted">
            Pads stay in this browser, on this device.{' '}
            <button type="button" className="link" onClick={() => file.current?.click()}>Open a pad file…</button>
            <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => open(e.target.files?.[0])} />
          </p>
        </div>
      </section>

      {pads.length > 0 && (
        <section className="stack" aria-label="Your pads">
          {pads.map((p) => (
            <a key={p.id} href={href.pad(p.id)} className="mini-pad">
              <span className="binding" aria-hidden="true" />
              <span className="mini-sheet">
                <span className="hand mini-title">{p.title}</span>
                <span className="mini-passage">{p.passage}</span>
                <span className="mini-date">{new Date(p.updated).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
              </span>
            </a>
          ))}
        </section>
      )}
    </div>
  );
}
