import type { Lengths } from './refs';

// Fetched from public/text/en/ on demand; each book is fetched once per visit.
const books = new Map<string, Promise<string[][]>>();
let lengths: Promise<Lengths> | undefined;

async function json<T>(path: string): Promise<T> {
  const r = await fetch(path);
  // A missing file on a static host can come back as the HTML app shell with 200;
  // checking the content type stops that being parsed as an empty Bible.
  if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) {
    throw new Error(`${path} could not be loaded (${r.status})`);
  }
  return r.json() as Promise<T>;
}

export const loadLengths = () => (lengths ??= json<Lengths>('text/en/books.json'));

export function loadBook(code: string): Promise<string[][]> {
  let p = books.get(code);
  if (!p) {
    p = json<string[][]>(`text/en/${code}.json`);
    // A failed fetch is not cached, so the next attempt tries again.
    p.catch(() => books.delete(code));
    books.set(code, p);
  }
  return p;
}
