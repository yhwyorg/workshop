import { describe, expect, it } from 'vitest';
import { href, parse } from './route';

describe('routes', () => {
  it.each([
    ['#/', { view: 'home' }],
    ['', { view: 'home' }],
    ['#/study/abc', { view: 'study', id: 'abc' }],
    ['#/new', { view: 'new' }],
    ['#/studies', { view: 'studies' }],
    ['#/paper', { view: 'paper' }],
    ['#/about', { view: 'about' }],
    ['#/advent', { view: 'advent' }],
  ])('%s', (hash, want) => expect(parse(hash)).toEqual(want));

  it('still opens links from the first version, when studies were "pads" and paper was "skins"', () => {
    expect(parse('#/pad/abc')).toEqual({ view: 'study', id: 'abc' });
    expect(parse('#/skins')).toEqual({ view: 'paper' });
  });

  it('round-trips a study link', () => {
    expect(parse(href.study('a b/c'))).toEqual({ view: 'study', id: 'a b/c' });
  });
});
