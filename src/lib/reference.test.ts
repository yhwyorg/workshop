import { describe, expect, it } from 'vitest';
import bsbJhn15 from '../../e2e/recorded/BSB_JHN_15.json';
import mhJhn15 from '../../e2e/recorded/c_matthew-henry_JHN_15.json';
import { BOOKS } from './books';
import { MAX_REFERENCES, REFERENCES, chapterUrl, loadReference, readCommentary, readReferences, readTranslation, usfm } from './reference';

// The book ids bible.helloao.org serves, as listed by /api/BSB/books.json on 2026-10-31.
const API_BOOKS =
  'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ');

describe('book codes', () => {
  it('map every one of our 66 books to the id the API serves', () => {
    // eBible's codes (JOH, MAR, SOL…) and the API's USFM codes differ for 11 books; a
    // wrong one returns 404 and would read as "this commentary has nothing on John".
    expect(BOOKS.map((b) => usfm(b.code))).toEqual(API_BOOKS);
  });

  it('builds chapter addresses with the API code', () => {
    const kjv = REFERENCES.find((r) => r.id === 'kjv')!;
    expect(chapterUrl(kjv, 'JOH', 15)).toBe('https://bible.helloao.org/api/eng_kjv/JHN/15.json');
    const mh = REFERENCES.find((r) => r.id === 'matthew-henry')!;
    expect(chapterUrl(mh, 'SOL', 2)).toBe('https://bible.helloao.org/api/c/matthew-henry/SNG/2.json');
  });
});

describe('reading a translation', () => {
  it('keeps every verse in order, with its text joined from styled pieces', () => {
    const t = readTranslation(bsbJhn15, 15);
    expect(t.verses.map((v) => v.number)).toEqual(Array.from({ length: 27 }, (_, i) => i + 1));
    expect(t.verses[0].text).toBe('“I am the true vine, and My Father is the keeper of the vineyard.');
    expect(t.verses.every((v) => v.text.trim().length > 0)).toBe(true);
  });

  it('keeps headings where they fall', () => {
    expect(readTranslation(bsbJhn15, 15).headings[1]).toBe('Jesus the True Vine');
  });

  it('refuses a response for the wrong chapter rather than showing it', () => {
    expect(() => readTranslation(bsbJhn15, 16)).toThrow(/chapter 15, not 16/);
  });
});

describe('reading a commentary', () => {
  it('gives the introduction and each note under the verse it starts at', () => {
    const c = readCommentary(mhJhn15, 15);
    expect(c.introduction?.[0]).toMatch(/^It is generally agreed that Christ's discourse/);
    expect(c.notes.map((n) => n.verse)).toEqual([1, 9, 18, 26]);
    expect(c.notes[0].paragraphs[0]).toMatch(/^Here Christ discourses concerning the fruit/);
  });
});

describe('fetching', () => {
  const kjv = REFERENCES.find((r) => r.id === 'kjv')!;
  const calvin = REFERENCES.find((r) => r.id === 'john-calvin')!;
  const respond = (status: number, body: string, type = 'application/json') => async () =>
    new Response(body, { status, headers: { 'content-type': type } });

  it('says a commentary does not cover a book, distinctly from failing to load', async () => {
    // The API answers a book it lacks with a 404 HTML page.
    const r = await loadReference(calvin, 'RUT', 1, respond(404, '<html>Not found</html>', 'text/html'));
    expect(r).toEqual({ state: 'not-covered' });
  });

  it('reports a failure to load, never an empty page', async () => {
    const r = await loadReference(kjv, 'JOH', 15, async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(r).toEqual({ state: 'failed', reason: 'unreachable', message: 'Failed to fetch' });
  });

  it('treats a page that is not JSON as a failure', async () => {
    const r = await loadReference(kjv, 'JOH', 15, respond(200, '<html>maintenance</html>', 'text/html'));
    expect(r).toMatchObject({ state: 'failed', reason: 'unreadable' });
  });

  it('reads a good response', async () => {
    const r = await loadReference(kjv, 'JOH', 15, respond(200, JSON.stringify(bsbJhn15)));
    expect(r.state === 'translation' && r.verses.length).toBe(27);
  });
});

describe('the references offered', () => {
  it('each name a licence that allows this use', () => {
    for (const r of REFERENCES) expect(r.licence, r.id).toMatch(/^(Public domain|CC BY-SA 4\.0)$/);
  });

  it('credit share-alike sources as their licence requires', () => {
    for (const r of REFERENCES.filter((x) => x.licence.startsWith('CC BY-SA'))) {
      expect(r.attribution, r.id).toBeTruthy();
    }
  });
});

describe('the references kept open', () => {
  const ids = (refs: { id: string }[]) => refs.map((r) => r.id);

  it('come back in the order they were opened', () => {
    expect(ids(readReferences('["bsb","kjv","matthew-henry"]', null))).toEqual(['bsb', 'kjv', 'matthew-henry']);
  });

  it('keep the one reference saved before several could be open', () => {
    expect(ids(readReferences(null, 'kjv'))).toEqual(['kjv']);
  });

  it('skip ids this version does not offer, and repeats, rather than failing', () => {
    expect(ids(readReferences('["kjv","msg-withdrawn","kjv"]', null))).toEqual(['kjv']);
  });

  it('are none when what was stored is unreadable', () => {
    expect(readReferences('{not json', 'kjv')).toEqual([]);
    expect(readReferences('"kjv"', null)).toEqual([]);
  });

  it('are never more than the columns can hold', () => {
    const all = JSON.stringify(REFERENCES.map((r) => r.id));
    expect(readReferences(all, null)).toHaveLength(MAX_REFERENCES);
  });
});
