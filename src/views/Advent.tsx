import { useEffect } from 'react';
import { ADVENT, adventWeek, seasonYear, weekStart } from '../lib/advent';

const dayOf = (d: Date) => d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

export default function Advent({ open }: { open: (passage: string) => void }) {
  useEffect(() => {
    document.title = 'Advent · Sermon Workshop';
  }, []);
  const now = new Date();
  const year = seasonYear(now);
  const current = adventWeek(now);
  return (
    <article className="page-paper advent">
      <h1>Advent</h1>
      <p>
        The Gospel readings that open each week of <cite>{ADVENT.book}</cite>, by {ADVENT.author}, with a few words from the
        book. Tap a reading to open it in your Bible.
      </p>
      {current === null && <p className="advent-next">Advent begins on Sunday, {dayOf(weekStart(year, 0))}.</p>}
      {ADVENT.weeks.map((w, i) => (
        <section key={w.name} className={`advent-week${current === i ? ' now' : ''}`} role="region" aria-label={w.name}>
          <h2>{w.name}{current === i && <span className="advent-now">This week</span>}</h2>
          <p className="advent-date">Begins Sunday, {dayOf(weekStart(year, i))}</p>
          <div className="advent-readings">
            {w.readings.map((r) => <button key={r} type="button" onClick={() => open(r)}>{r}</button>)}
          </div>
          <blockquote className="advent-snippet">
            <p>“{w.snippet}”</p>
            <footer>From <cite>Awaken Wonder</cite></footer>
          </blockquote>
          {/* In tabs of their own, so the page stays where it was. */}
          <p className="advent-links">
            <a href={w.excerpt} target="_blank" rel="noopener">Read the whole reflection</a>
            <a href={ADVENT.buy} target="_blank" rel="noopener">Get the book</a>
          </p>
        </section>
      ))}
      <p className="advent-book">
        The book has a reflection and a prayer for each day. <a href={ADVENT.buy} target="_blank" rel="noopener">Get the book</a>
      </p>
    </article>
  );
}
