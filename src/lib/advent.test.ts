import { describe, expect, it } from 'vitest';
import { ADVENT, adventStart, adventWeek, seasonYear } from './advent';

const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
const ymd = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

describe('when Advent begins', () => {
  it.each([
    // The fourth Sunday before Christmas, in each kind of year.
    [2025, [2025, 11, 30]], // Christmas on a Thursday
    [2026, [2026, 11, 29]], // a Friday
    [2027, [2027, 11, 28]], // a Saturday
    [2023, [2023, 12, 3]], // a Monday: the shortest Advent, its last week one day long
    [2022, [2022, 11, 27]], // a Sunday: Christmas itself is not the fourth Sunday's week
  ])('%i', (year, want) => {
    expect(ymd(adventStart(year))).toEqual(want);
    expect(adventStart(year).getDay()).toBe(0);
  });
});

describe('which week it is', () => {
  it.each([
    [day(2026, 11, 28), null],
    [day(2026, 11, 29, 0), 0],
    [day(2026, 12, 5, 23), 0],
    [day(2026, 12, 6), 1],
    [day(2026, 12, 13), 2],
    [day(2026, 12, 20), 3],
    [day(2026, 12, 24, 23), 3],
    // Christmas is what the weeks led to, and not a fifth of them.
    [day(2026, 12, 25), null],
    [day(2026, 1, 3), null],
  ])('%s', (now, want) => expect(adventWeek(now)).toBe(want));
});

describe('which Advent to show', () => {
  it('is this year’s until Christmas Day, then the next', () => {
    expect(seasonYear(day(2026, 11, 1))).toBe(2026);
    expect(seasonYear(day(2026, 12, 24))).toBe(2026);
    expect(seasonYear(day(2026, 12, 25))).toBe(2027);
    expect(seasonYear(day(2027, 3, 1))).toBe(2027);
  });
});

describe('the weeks', () => {
  it('are four, each with its readings and a link to the author’s own excerpt', () => {
    expect(ADVENT.weeks).toHaveLength(4);
    for (const w of ADVENT.weeks) {
      expect(w.readings.length).toBeGreaterThan(0);
      expect(w.excerpt).toMatch(/^https:\/\/www\.darrelljohnson\.ca\/articles\//);
    }
  });

  it('quote no more than a snippet of the book, to send people to it rather than replace it', () => {
    // The user: "protect my dad's IP", with "snippets of his book so it drives people to the book".
    for (const w of ADVENT.weeks) {
      const words = w.snippet.split(/\s+/).length;
      expect(words).toBeGreaterThan(0);
      expect(words).toBeLessThanOrEqual(30);
    }
  });
});
