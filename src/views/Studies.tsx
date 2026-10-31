import { useEffect } from 'react';
import { href } from '../lib/route';
import type { Study } from '../lib/studies';

export default function Studies({ studies }: { studies: Study[] }) {
  useEffect(() => {
    document.title = 'Your studies · Sermon Workshop';
  }, []);
  const sorted = [...studies].sort((a, b) => b.updated.localeCompare(a.updated));
  return (
    <section className="studies page-paper">
      <h1>Your studies</h1>
      {sorted.length === 0 ? (
        <p className="quiet">Nothing here yet.</p>
      ) : (
        <ol className="study-list">
          {sorted.map((s) => (
            <li key={s.id}>
              <a href={href.study(s.id)}>
                <span className="study-title">{s.title || s.passage}</span>
                {s.title && s.title !== s.passage && <span className="study-passage">{s.passage}</span>}
                <span className="study-date">{new Date(s.updated).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
              </a>
            </li>
          ))}
        </ol>
      )}
      <p>
        <a className="button" href={href.new()}>Begin a new study</a>
      </p>
      <p className="quiet small">Studies are kept in this browser, on this device. Use “Save a copy” to keep one elsewhere.</p>
    </section>
  );
}
