import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { load, save, STORE_KEY, type KV, type Loaded, type Pad, type Store } from './lib/pads';
import type { Lengths } from './lib/refs';
import { href, useRoute } from './lib/route';
import { applySkin, validateSkin, type Skin } from './lib/skin';
import { loadLengths } from './lib/text';
import { BUILT_IN, DEFAULT_SKIN } from './skins';
import About from './views/About';
import Desk from './views/Desk';
import PadView from './views/PadView';
import Skins from './views/Skins';

// localStorage itself can throw on access (blocked site data), not just on use.
const kv: KV = {
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => localStorage.setItem(k, v),
};

const SKIN_KEY = 'workshop:skin';
const CUSTOM_KEY = 'workshop:skins';

export interface SkinEntry {
  id: string;
  skin: Skin;
  custom: boolean;
}

/** Built-ins plus the reader's own skins, each re-checked: stored data is never trusted. */
function readSkins(): SkinEntry[] {
  const out: SkinEntry[] = [];
  for (const [id, raw] of Object.entries(BUILT_IN)) {
    const r = validateSkin(raw);
    if (!r.ok) throw new Error(`built-in skin ${id}: ${r.errors.join('; ')}`);
    out.push({ id, skin: r.skin, custom: false });
  }
  try {
    const custom = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]') as unknown[];
    custom.forEach((raw, i) => {
      const r = validateSkin(raw);
      if (r.ok) out.push({ id: `custom-${i}`, skin: r.skin, custom: true });
    });
  } catch {
    /* no saved skins, or storage blocked */
  }
  return out;
}

export default function App() {
  const route = useRoute();
  const [loaded, setLoaded] = useState<Loaded>(() => load(kv));
  const [store, setStore] = useState<Store | null>(loaded.state === 'ok' || loaded.state === 'empty' ? loaded.store : null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lengths, setLengths] = useState<Lengths | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [skins, setSkins] = useState<SkinEntry[]>(readSkins);
  const [skinId, setSkinId] = useState<string>(() => {
    try {
      return localStorage.getItem(SKIN_KEY) ?? DEFAULT_SKIN;
    } catch {
      return DEFAULT_SKIN;
    }
  });
  const skin = (skins.find((s) => s.id === skinId) ?? skins.find((s) => s.id === DEFAULT_SKIN)!).skin;

  useEffect(() => applySkin(skin), [skin]);
  // After "start a clean desk", the freshly loaded (empty) store becomes the one in use.
  useEffect(() => {
    if (loaded.state === 'ok' || loaded.state === 'empty') setStore((s) => s ?? loaded.store);
  }, [loaded]);
  useEffect(() => {
    loadLengths().then(setLengths, (e: Error) => setTextError(e.message));
  }, []);

  // Saves shortly after the last change; a failure stays on screen until a save succeeds.
  const first = useRef(true);
  useEffect(() => {
    if (!store) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      try {
        save(kv, store);
        setSaveError(null);
      } catch (e) {
        setSaveError((e as Error).message);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [store]);

  const updatePad = useCallback((id: string, change: (p: Pad) => Pad) => {
    setStore((s) => s && { ...s, pads: s.pads.map((p) => (p.id === id ? { ...change(p), updated: new Date().toISOString() } : p)) });
  }, []);
  const addPad = useCallback((pad: Pad) => setStore((s) => s && { ...s, pads: [pad, ...s.pads] }), []);
  const removePad = useCallback((id: string) => setStore((s) => s && { ...s, pads: s.pads.filter((p) => p.id !== id) }), []);

  const chooseSkin = (id: string) => {
    setSkinId(id);
    try {
      localStorage.setItem(SKIN_KEY, id);
    } catch {
      /* the choice lasts this visit only */
    }
  };
  const saveCustom = (list: Skin[]) => {
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
    } catch {
      /* kept for this visit only */
    }
    setSkins(readSkins());
  };
  const customSkins = useMemo(() => skins.filter((s) => s.custom).map((s) => s.skin), [skins]);

  if (loaded.state === 'corrupt') {
    return <Corrupt loaded={loaded} onReset={() => setLoaded(moveAside(loaded.raw))} />;
  }

  return (
    <div className="desk">
      <header className="topbar">
        <a href={href.desk()} className="brand">Sermon Workshop</a>
        <nav>
          <a href={href.desk()} aria-current={route.view === 'desk' ? 'page' : undefined}>Desk</a>
          <a href={href.skins()} aria-current={route.view === 'skins' ? 'page' : undefined}>Skins</a>
          <a href={href.about()} aria-current={route.view === 'about' ? 'page' : undefined}>About</a>
        </nav>
      </header>

      {loaded.state === 'unavailable' && (
        <p className="alert" role="alert">
          This browser isn’t letting the workshop save ({loaded.reason}). You can still work, but nothing will be kept
          when this tab closes: use <strong>Export</strong> on a pad to keep a copy.
        </p>
      )}
      {saveError && (
        <p className="alert" role="alert">
          Your last change could not be saved ({saveError}). Export the pad you are working on to keep a copy.
        </p>
      )}
      {textError && (
        <p className="alert" role="alert">The Bible text could not be loaded ({textError}). Try reloading the page.</p>
      )}

      <main>
        {route.view === 'skins' ? (
          <Skins skins={skins} current={skinId} choose={chooseSkin} custom={customSkins} saveCustom={saveCustom} />
        ) : route.view === 'about' ? (
          <About />
        ) : !store ? null : route.view === 'pad' ? (
          <PadView
            pad={store.pads.find((p) => p.id === route.id)}
            lengths={lengths}
            update={updatePad}
            remove={removePad}
          />
        ) : (
          <Desk pads={store.pads} lengths={lengths} add={addPad} />
        )}
      </main>
    </div>
  );
}

/** Keeps the unreadable data under another key, so starting fresh never destroys it. */
function moveAside(raw: string): Loaded {
  const aside = `${STORE_KEY}:unreadable:${new Date().toISOString()}`;
  try {
    localStorage.setItem(aside, raw);
    localStorage.removeItem(STORE_KEY);
  } catch (e) {
    return { state: 'unavailable', reason: (e as Error).message };
  }
  return load(kv);
}

function Corrupt({ loaded, onReset }: { loaded: Extract<Loaded, { state: 'corrupt' }>; onReset: () => void }) {
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([loaded.raw], { type: 'application/json' }));
    a.download = 'workshop-pads-unreadable.json';
    a.click();
  };
  return (
    <div className="desk">
      <main>
        <section className="paper notice" role="alert">
          <h1>Your saved pads couldn’t be read</h1>
          <p>
            Something in this browser’s saved data is damaged ({loaded.reason}). Nothing has been changed or deleted.
            Download a copy first; then you can start with a clean desk, and the damaged data stays saved alongside
            in case it can be recovered.
          </p>
          <p className="actions">
            <button type="button" onClick={download}>Download the saved data</button>
            <button type="button" onClick={onReset}>Start a clean desk</button>
          </p>
        </section>
      </main>
    </div>
  );
}
