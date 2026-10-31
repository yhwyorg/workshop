import { useEffect, type RefObject } from 'react';

/** The panes that scroll together: the Bible and every reference. Never the notes. */
const READING = '.bible-pane, .ref-pane';

/**
 * Where a pane is: the last verse to begin at or above its top edge, and how far
 * through that verse the edge is. "First verse still in view" was wrong: verses run on
 * in one paragraph, so the verse before shares the top line with the one beginning
 * there, and it was taken as the place (seen as the Bible at verse 9 when 10 was on top).
 */
function place(pane: HTMLElement) {
  const top = pane.getBoundingClientRect().top + 2;
  let at: { verse: number; through: number } | null = null;
  for (const el of pane.querySelectorAll<HTMLElement>('[data-verse]')) {
    const r = el.getBoundingClientRect();
    if (r.top > top) break;
    at = { verse: Number(el.dataset.verse), through: Math.min(1, Math.max(0, (top - 2 - r.top) / (r.height || 1))) };
  }
  return at;
}

/**
 * Brings a pane to a verse. A commentary has notes only where they begin, so it goes to
 * the last note starting at or before the verse; how far through the verse the leader
 * is only carries over when both panes show that very verse.
 */
function follow(pane: HTMLElement, at: { verse: number; through: number }) {
  let target: HTMLElement | null = null;
  for (const el of pane.querySelectorAll<HTMLElement>('[data-verse]')) {
    if (Number(el.dataset.verse) <= at.verse) target = el;
  }
  if (!target) return pane.scrollTo({ top: 0 });
  const r = target.getBoundingClientRect();
  const through = Number(target.dataset.verse) === at.verse ? at.through : 0;
  pane.scrollTop += r.top + through * r.height - pane.getBoundingClientRect().top;
}

/**
 * While `on`, scrolling the Bible or any reference brings the others to the same verse.
 *
 * Each programmatic scroll fires a scroll event of its own a moment later. Without
 * telling those apart from the reader's, the panes chase each other: the follower's echo
 * moves the leader to where the follower's nearest verse begins, and so on. A pane is
 * marked as following only when the move actually changed its position, or the mark
 * would wait for an event that never comes and swallow the reader's next scroll.
 */
export function useScrollLock(root: RefObject<HTMLElement | null>, on: boolean) {
  useEffect(() => {
    const el = root.current;
    if (!on || !el) return;
    const following = new WeakSet<Element>();
    const scrolled = (e: Event) => {
      const leader = e.target as HTMLElement;
      if (!(leader instanceof HTMLElement) || !leader.matches(READING)) return;
      if (following.has(leader)) {
        following.delete(leader);
        return;
      }
      const at = leader.scrollTop === 0 ? null : place(leader);
      for (const pane of el.querySelectorAll<HTMLElement>(READING)) {
        // Hidden panes (a phone shows one at a time) have no layout to measure.
        if (pane === leader || !pane.offsetParent) continue;
        const before = pane.scrollTop;
        if (at) follow(pane, at);
        else pane.scrollTo({ top: 0 });
        if (pane.scrollTop !== before) following.add(pane);
      }
    };
    // Scroll events don't bubble; capturing sees every pane's.
    el.addEventListener('scroll', scrolled, true);
    return () => el.removeEventListener('scroll', scrolled, true);
  }, [root, on]);
}
