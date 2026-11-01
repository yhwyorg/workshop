import { useEffect, useState } from 'react';

// Hash routes keep every page a plain static file on GitHub Pages, which has no
// rewrite rules: a path route would 404 when reloaded or shared.
export type Route =
  | { view: 'home' }
  | { view: 'study'; id: string }
  | { view: 'new' }
  | { view: 'studies' }
  | { view: 'paper' }
  | { view: 'about' }
  | { view: 'advent' };

export function parse(hash: string): Route {
  const [head, ...rest] = hash.replace(/^#\/?/, '').split('/');
  switch (head) {
    // "pad" and "skins" are the first version's names; links to them still work.
    case 'study':
    case 'pad':
      return rest[0] ? { view: 'study', id: decodeURIComponent(rest[0]) } : { view: 'home' };
    case 'new': return { view: 'new' };
    case 'studies': return { view: 'studies' };
    case 'paper':
    case 'skins':
      return { view: 'paper' };
    case 'about': return { view: 'about' };
    case 'advent': return { view: 'advent' };
    default: return { view: 'home' };
  }
}

export const href = {
  home: () => '#/',
  study: (id: string) => `#/study/${encodeURIComponent(id)}`,
  new: () => '#/new',
  studies: () => '#/studies',
  paper: () => '#/paper',
  about: () => '#/about',
  advent: () => '#/advent',
};

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parse(location.hash));
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}
