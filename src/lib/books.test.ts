import { describe, expect, it } from 'vitest';
import { BOOKS, shortName } from './books';

describe('a book’s short name', () => {
  it('fits the toolbar on an upright iPad or a phone, for every book', () => {
    // Long names ran the toolbar off the screen: 1 Thessalonians was 851px on an 834px iPad.
    const tooLong = BOOKS.map((b) => shortName(b.code)).filter((n) => n.length > 8);
    expect(tooLong).toEqual([]);
  });

  it('is the abbreviation a pastor would write', () => {
    expect(['1TH', 'DEU', 'PHI'].map(shortName)).toEqual(['1 Thess', 'Deut', 'Phil']);
  });

  it('leaves a name that already fits alone', () => {
    expect(['JOH', 'PSA', 'GEN'].map(shortName)).toEqual(['John', 'Psalms', 'Genesis']);
  });
});
