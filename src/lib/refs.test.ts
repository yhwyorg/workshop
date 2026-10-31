import { describe, expect, it } from 'vitest';
import lengths from '../../public/text/en/books.json';
import { BOOKS } from './books';
import { formatPassage, parsePassage, type Lengths } from './refs';

const look = (s: string) => formatPassage(parsePassage(s, lengths as Lengths));

describe('books', () => {
  it('match the text files exactly, in order', () => {
    expect(BOOKS.map((b) => b.code)).toEqual(Object.keys(lengths));
  });
});

describe('parsePassage', () => {
  it.each([
    ['John 15:1-11', 'John 15:1-11'],
    ['jn 3:16', 'John 3:16'],
    ['Ps 23', 'Psalms 23:1-6'],
    ['Psalm 23-24', 'Psalms 23:1-24:10'],
    ['1 Cor 13', '1 Corinthians 13:1-13'],
    ['1st Corinthians 13:4-7', '1 Corinthians 13:4-7'],
    ['II Kings 2:11', '2 Kings 2:11'],
    ['Gen 1:1–2:3', 'Genesis 1:1-2:3'],
    ['Jude 3', 'Jude 1:3'],
    ['Jude 20-25', 'Jude 1:20-25'],
    ['Song of Solomon 2:4', 'Song of Songs 2:4'],
    ['Mark 4.35-41', 'Mark 4:35-41'],
    // "1sa" as a Roman numeral would be "isa"; Isaiah must keep its abbreviation.
    ['Isa 53:5', 'Isaiah 53:5'],
    ['I Sam 3:10', '1 Samuel 3:10'],
  ])('%s -> %s', (input, want) => expect(look(input)).toBe(want));

  // Each must fail with a reason: a pad opened on nothing looks like a broken page.
  it.each([
    ['Hezekiah 1:1', /isn’t a book/],
    ['3 Corinthians 1:1', /isn’t a book/],
    ['John', /Add a chapter/],
    ['John 22:1', /has 21 chapters, not 22/],
    ['John 3:99', /has 36 verses, not 99/],
    ['John 3:16-14', /backwards/],
    ['Jude 2:1', /has 1 chapter, not 2/],
    ['', /Type a passage/],
  ])('%s is refused', (input, msg) => expect(() => look(input)).toThrow(msg));
});
