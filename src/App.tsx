import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lengths } from './lib/refs';
import { href, useRoute } from './lib/route';
import { applySkin, pensOf, validateSkin, type Skin } from './lib/skin';
import { exportStudy, importStudy, load, newStudy, save, STORE_KEY, type KV, type Loaded, type Store, type Study } from './lib/studies';
import { useMediaQuery } from './lib/media';
import { loadLengths } from './lib/text';
import { AUTO, BUILT_IN, DARK, DEFAULT, LIGHT } from './skins';
import About from './views/About';
import Contents from './views/Contents';
import Paper from './views/Paper';
import Studies from './views/Studies';
import StudyView from './views/StudyView';

// localStorage itself can throw on access (blocked site data), not just on use.
const kv: KV = {
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => localStorage.setItem(k, v),
};

const SKIN_KEY = 'workshop:skin';
const CUSTOM_KEY = 'workshop:skins';
const LAST_KEY = 'workshop:last';
/** "on" when the words of Jesus are shown in red. */
const RED_KEY = 'workshop:red-letter';

export interface SkinEntry {
  id: string;
  skin: Skin;
  custom: boolean;
}

/** Built-ins plus the reader's own, each re-checked: stored data is never trusted. */
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
    /* none saved, or storage blocked */
  }
  return out;
}

const remembered = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const remember = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* lasts this visit only */
  }
};

export default function App() {
  const route = useRoute();
  const [loaded, setLoaded] = useState<Loaded>(() => load(kv));
  const [store, setStore] = useState<Store | null>(loaded.state === 'ok' || loaded.state === 'empty' ? loaded.store : null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lengths, setLengths] = useState<Lengths | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [skins, setSkins] = useState<SkinEntry[]>(readSkins);
  const [skinId, setSkinId] = useState<string>(() => remembered(SKIN_KEY) ?? DEFAULT);
  const [menu, setMenu] = useState(false);
  const [redLetter, setRedLetter] = useState(() => remembered(RED_KEY) === 'on');
  useEffect(() => {
    document.documentElement.dataset.redLetter = redLetter ? 'on' : 'off';
  }, [redLetter]);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  // A style chosen before this one existed (the first version's names) falls back to
  // the default; "Automatic" follows the device: Daylight by day, Night in dark mode.
  const chosen = skinId === AUTO ? undefined : (skins.find((s) => s.id === skinId) ?? skins.find((s) => s.id === DEFAULT));
  const skin = (chosen ?? skins.find((s) => s.id === (prefersDark ? DARK : LIGHT))!).skin;

  useEffect(() => applySkin(skin), [skin]);
  useEffect(() => {
    loadLengths().then(setLengths, (e: Error) => setTextError(e.message));
  }, []);
  // After "start with a clean desk", the freshly loaded (empty) store becomes the one in use.
  useEffect(() => {
    if (loaded.state === 'ok' || loaded.state === 'empty') setStore((s) => s ?? loaded.store);
  }, [loaded]);
  useEffect(() => setMenu(false), [route]);

  // Saves shortly after the last change; a failure stays on screen until a save succeeds.
  const first = useRef(true);
  // The change still waiting to be saved, if any.
  const unsaved = useRef<Store | null>(null);
  const saveNow = useCallback(() => {
    if (!unsaved.current) return;
    try {
      save(kv, unsaved.current);
      unsaved.current = null;
      setSaveError(null);
    } catch (e) {
      setSaveError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (!store) return;
    if (first.current) {
      first.current = false;
      return;
    }
    unsaved.current = store;
    const t = setTimeout(saveNow, 300);
    return () => clearTimeout(t);
  }, [store, saveNow]);
  // Leaving inside that wait (closing the tab, switching apps on an iPad, which may never
  // come back to the page) lost the last change without a sign. Save on the way out.
  // pagehide covers closing and navigating; visibilitychange covers being put away, the
  // only warning iPad Safari reliably gives before discarding a page.
  useEffect(() => {
    const hidden = () => document.visibilityState === 'hidden' && saveNow();
    addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      removeEventListener('pagehide', saveNow);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [saveNow]);

  const update = useCallback((id: string, change: (s: Study) => Study) => {
    setStore((st) => st && { ...st, pads: st.pads.map((s) => (s.id === id ? { ...change(s), updated: new Date().toISOString() } : s)) });
  }, []);
  const add = useCallback((s: Study) => {
    setStore((st) => st && { ...st, pads: [s, ...st.pads] });
    location.hash = href.study(s.id);
  }, []);

  const studies = useMemo(() => store?.pads ?? [], [store]);
  const current = route.view === 'study' ? studies.find((s) => s.id === route.id) : undefined;
  useEffect(() => {
    if (current) remember(LAST_KEY, current.id);
  }, [current]);

  // Home is wherever work was left: the last study, else the list, else the Bible's contents.
  useEffect(() => {
    if (route.view !== 'home' || !store) return;
    const last = remembered(LAST_KEY);
    const target = studies.some((s) => s.id === last) ? href.study(last!) : studies.length ? href.studies() : href.new();
    location.replace(target);
  }, [route, store, studies]);

  const chooseSkin = (id: string) => {
    setSkinId(id);
    remember(SKIN_KEY, id);
  };
  const saveCustom = (list: Skin[]) => {
    remember(CUSTOM_KEY, JSON.stringify(list));
    setSkins(readSkins());
  };
  const customSkins = useMemo(() => skins.filter((s) => s.custom).map((s) => s.skin), [skins]);

  if (loaded.state === 'corrupt') return <Unreadable loaded={loaded} onReset={() => setLoaded(moveAside(loaded.raw))} />;

  return (
    <>
      {/* On a study the toolbar carries the menu; every other page has this one button. */}
      {route.view !== 'study' && (
        <button type="button" className="menu-button" onClick={() => setMenu(true)} aria-label="Menu" aria-expanded={menu}>
          <span aria-hidden="true" />
        </button>
      )}
      {menu && (
        <Menu
          current={current}
          redLetter={redLetter}
          setRedLetter={(on) => {
            setRedLetter(on);
            remember(RED_KEY, on ? 'on' : 'off');
          }}
          close={() => setMenu(false)}
          add={add}
          remove={(id) => {
            setStore((st) => st && { ...st, pads: st.pads.filter((s) => s.id !== id) });
            location.hash = href.studies();
          }}
        />
      )}

      {loaded.state === 'unavailable' && (
        <p className="alert" role="alert">
          This browser isn’t letting the workshop save ({loaded.reason}). You can keep working, but nothing will be kept
          when this tab closes. Use “Save a copy” in the menu to keep your study.
        </p>
      )}
      {saveError && (
        <p className="alert" role="alert">Your last change couldn’t be saved ({saveError}). Use “Save a copy” in the menu to keep your study.</p>
      )}
      {textError && <p className="alert" role="alert">The Bible couldn’t be loaded ({textError}). Try reloading the page.</p>}

      <main>
        {route.view === 'paper' ? (
          <Paper skins={skins} current={chosen ? chosen.id : AUTO} choose={chooseSkin} custom={customSkins} saveCustom={saveCustom} />
        ) : route.view === 'about' ? (
          <About />
        ) : !store ? null : route.view === 'study' ? (
          <StudyView study={current} lengths={lengths} update={update} openMenu={() => setMenu(true)} pens={pensOf(skin)} penArt={skin.pen} />
        ) : route.view === 'studies' ? (
          <Studies studies={studies} />
        ) : route.view === 'new' ? (
          <Contents lengths={lengths} open={(passage) => add(newStudy(passage, ''))} />
        ) : null}
      </main>
    </>
  );
}

function Menu({ current, redLetter, setRedLetter, close, add, remove }: {
  current: Study | undefined;
  redLetter: boolean;
  setRedLetter: (on: boolean) => void;
  close: () => void;
  add: (s: Study) => void;
  remove: (id: string) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [close]);

  const printAs = (mode: 'notes' | 'lines') => {
    document.body.dataset.print = mode;
    close();
    // Let the menu close and the print layout settle before the dialog opens.
    requestAnimationFrame(() => requestAnimationFrame(() => print()));
  };
  const saveCopy = (s: Study) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportStudy(s)], { type: 'application/json' }));
    a.download = `${(s.title || s.passage).replace(/[^\w\s:-]/g, '').replace(/:/g, '.').trim() || 'study'}.study.json`;
    a.click();
  };
  const openCopy = async (f: File | undefined) => {
    if (!f) return;
    try {
      add(importStudy(await f.text()));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="menu-backdrop" onClick={close}>
      <nav className="menu page-paper" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="menu-close" onClick={close} aria-label="Close">×</button>
        <p className="menu-brand">Sermon Workshop</p>
        <a href={href.new()}>Begin a new study</a>
        <a href={href.studies()}>Your studies</a>
        {current && (
          <>
            <hr />
            <p className="menu-label">{current.title || current.passage}</p>
            <button type="button" onClick={() => printAs('lines')}>Print with lines to write on</button>
            <button type="button" onClick={() => printAs('notes')}>Print my notes</button>
            <button type="button" onClick={() => saveCopy(current)}>Save a copy</button>
            <button
              type="button"
              className="danger"
              onClick={() => confirm(`Delete “${current.title || current.passage}”? This can’t be undone.`) && remove(current.id)}
            >
              Delete this study
            </button>
          </>
        )}
        <hr />
        <button type="button" aria-pressed={redLetter} onClick={() => setRedLetter(!redLetter)} className="menu-toggle">
          Words of Jesus in red
        </button>
        <hr />
        <button type="button" onClick={() => file.current?.click()}>Open a saved copy…</button>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => openCopy(e.target.files?.[0])} />
        {error && <p className="error" role="alert">{error}</p>}
        <a href={href.paper()}>Paper</a>
        <a href={href.about()}>About</a>
      </nav>
    </div>
  );
}

/** Keeps unreadable data under another key, so starting fresh never destroys it. */
function moveAside(raw: string): Loaded {
  try {
    localStorage.setItem(`${STORE_KEY}:unreadable:${new Date().toISOString()}`, raw);
    localStorage.removeItem(STORE_KEY);
  } catch (e) {
    return { state: 'unavailable', reason: (e as Error).message };
  }
  return load(kv);
}

function Unreadable({ loaded, onReset }: { loaded: Extract<Loaded, { state: 'corrupt' }>; onReset: () => void }) {
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([loaded.raw], { type: 'application/json' }));
    a.download = 'workshop-studies-unreadable.json';
    a.click();
  };
  return (
    <main>
      <section className="page-paper notice" role="alert">
        <h1>Your saved studies couldn’t be read</h1>
        <p>
          Something in this browser’s saved data is damaged ({loaded.reason}). Nothing has been changed or deleted.
          Download a copy first; then you can start with a clean desk, and the damaged data stays saved alongside in
          case it can be recovered.
        </p>
        <p className="actions">
          <button type="button" onClick={download}>Download the saved data</button>
          <button type="button" onClick={onReset}>Start with a clean desk</button>
        </p>
      </section>
    </main>
  );
}
