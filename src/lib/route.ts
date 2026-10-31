import { useEffect, useState } from 'react';

// Hash routes keep every page a plain static file on GitHub Pages, which has no
// rewrite rules: a path route would 404 when reloaded or shared.
export type Route = { view: 'desk' } | { view: 'pad'; id: string } | { view: 'skins' } | { view: 'about' };

export function parse(hash: string): Route {
  const [head, ...rest] = hash.replace(/^#\/?/, '').split('/');
  if (head === 'pad' && rest[0]) return { view: 'pad', id: decodeURIComponent(rest[0]) };
  if (head === 'skins') return { view: 'skins' };
  if (head === 'about') return { view: 'about' };
  return { view: 'desk' };
}

export const href = {
  desk: () => '#/',
  pad: (id: string) => `#/pad/${encodeURIComponent(id)}`,
  skins: () => '#/skins',
  about: () => '#/about',
};

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(location.hash));
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}
