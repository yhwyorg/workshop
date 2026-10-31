import { useEffect, useRef, useState } from 'react';
import type { SkinEntry } from '../App';
import { SKIN_PROMPT, skinStyle, validateSkin, type Skin } from '../lib/skin';

export default function Paper({ skins, current, choose, custom, saveCustom }: {
  skins: SkinEntry[];
  current: string;
  choose: (id: string) => void;
  custom: Skin[];
  saveCustom: (list: Skin[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState<{ errors: string[]; warnings: string[]; added?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Paper · Sermon Workshop';
  }, []);

  const add = (text: string) => {
    let parsed: unknown;
    try {
      // AIs often wrap JSON in a code fence; take what is inside it.
      parsed = JSON.parse(text.replace(/^[\s\S]*?```(?:json)?\s*([\s\S]*?)```[\s\S]*$/, '$1').trim());
    } catch {
      return setResult({ errors: ['That isn’t JSON. Paste only the skin your AI wrote, starting with “{”.'], warnings: [] });
    }
    const r = validateSkin(parsed);
    if (!r.ok) return setResult({ errors: r.errors, warnings: [] });
    saveCustom([...custom, r.skin]);
    choose(`custom-${custom.length}`);
    setDraft('');
    setResult({ errors: [], warnings: r.warnings, added: r.skin.name });
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(SKIN_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setDraft(SKIN_PROMPT);
    }
  };

  return (
    <div className="skins-page">
      <section className="page-paper intro">
        <h1>Paper</h1>
        <p>Choose the paper and desk you like to work on.</p>
      </section>

      <div className="skin-grid">
        {skins.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`skin-card${s.id === current ? ' current' : ''}`}
            style={skinStyle(s.skin) as React.CSSProperties}
            onClick={() => choose(s.id)}
            aria-pressed={s.id === current}
          >
            <span className="skin-preview">
              <span className="binding" />
              <span className="skin-sheet">
                <span className="skin-scripture">In the beginning was the Word…</span>
                <span className="skin-note">remain → 11×!</span>
              </span>
            </span>
            <span className="skin-name">{s.skin.name}</span>
            {s.custom && s.skin.author && <span className="skin-by">by {s.skin.author}</span>}
          </button>
        ))}
      </div>

      <details className="page-paper make">
        <summary>Make your own paper with AI</summary>
        <p className="quiet small">
          A paper style is a short description of colors, not a program, so one from anyone is safe to try: it can change
          how the page looks and nothing else.
        </p>
        <ol>
          <li>
            <button type="button" onClick={copyPrompt}>{copied ? 'Copied' : 'Copy the instructions'}</button> and paste them into
            ChatGPT, Claude, Gemini or any AI.
          </li>
          <li>At the end, describe the look you want: “an old leather journal”, “Advent purple”, “my grandfather’s study”.</li>
          <li>Paste what it writes back here.</li>
        </ol>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} placeholder='{ "format": "workshop-skin/1", … }' spellCheck={false} />
        <p className="actions">
          <button type="button" onClick={() => add(draft)} disabled={!draft.trim()}>Try it</button>
          <button type="button" onClick={() => file.current?.click()}>Open a paper file…</button>
          <input ref={file} type="file" accept=".json,application/json" hidden onChange={async (e) => e.target.files?.[0] && add(await e.target.files[0].text())} />
          {custom.length > 0 && (
            <button type="button" className="danger" onClick={() => confirm('Remove all the paper styles you added?') && saveCustom([])}>
              Remove the ones I added
            </button>
          )}
        </p>
        {result?.added && <p className="ok" role="status">Added “{result.added}” and switched to it.</p>}
        {result && result.errors.length > 0 && (
          <div className="error" role="alert">
            <p>This can’t be used yet. Tell your AI:</p>
            <ul>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
        {result && result.warnings.length > 0 && <ul className="quiet small">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
      </details>
    </div>
  );
}
