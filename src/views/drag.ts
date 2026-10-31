import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Follows a pointer from a press until it lifts, for things dragged about the screen
 * (the toolbar, the pen). Only movement past `threshold` pixels counts as a drag, so a
 * tap stays a tap: `end` says whether it moved.
 *
 * Followed on the window, not the pressed element: picking the pen up takes its photo
 * out of the toolbar mid-drag, and listeners (or pointer capture) on the removed element
 * would stop hearing the pointer, dropping the pen where the drag began.
 */
export function drag(
  e: ReactPointerEvent<HTMLElement>,
  handlers: { move: (dx: number, dy: number, ev: PointerEvent) => void; end: (moved: boolean, ev: PointerEvent) => void },
  threshold = 6,
) {
  e.preventDefault();
  const id = e.pointerId;
  const [x0, y0] = [e.clientX, e.clientY];
  let moved = false;
  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return;
    const [dx, dy] = [ev.clientX - x0, ev.clientY - y0];
    if (!moved && Math.hypot(dx, dy) < threshold) return;
    moved = true;
    handlers.move(dx, dy, ev);
  };
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return;
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', up);
    handlers.end(moved, ev);
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
}

/** Keeps a box of the given size wholly on screen, with a small margin. */
export function onScreen(x: number, y: number, w: number, h: number, margin = 8) {
  return {
    x: Math.round(Math.min(Math.max(x, margin), Math.max(margin, innerWidth - w - margin))),
    y: Math.round(Math.min(Math.max(y, margin), Math.max(margin, innerHeight - h - margin))),
  };
}
