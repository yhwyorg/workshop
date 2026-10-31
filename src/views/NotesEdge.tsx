import { useRef, type RefObject } from 'react';

/**
 * The notepad's edge, dragged to make it bigger or smaller: its left edge beside the
 * Bible, its top edge on an upright iPad. Arrow keys move it too, and a double-click
 * puts it back to where it started.
 *
 * Only the pane's size changes. The page inside is laid out at one width and zooms to
 * fill it (Fit), so a bigger notepad is a bigger page to write on, and ink keeps its
 * place on the words.
 */
export default function NotesEdge({ workspace, upright, size, setSize, done }: {
  workspace: RefObject<HTMLDivElement | null>;
  /** True on an upright iPad, where the notes are below the Bible. */
  upright: boolean;
  /** Width (or, upright, height) in pixels; null for the layout's own. */
  size: number | null;
  setSize: (px: number | null) => void;
  /** Called when a drag or key press ends, to keep the size. */
  done: (px: number | null) => void;
}) {
  // Room left for the Bible beside or above, and the least a notepad can be.
  const limits = () => {
    const r = workspace.current!.getBoundingClientRect();
    return upright ? { min: 160, max: r.height - 220, r } : { min: 300, max: r.width - 380, r };
  };
  const clamp = (px: number) => {
    const { min, max } = limits();
    return Math.round(Math.max(min, Math.min(max, px)));
  };
  const current = () => {
    const pane = workspace.current!.querySelector('.notes-pane')!.getBoundingClientRect();
    return size ?? (upright ? pane.height : pane.width);
  };
  // The size the drag reached; a ref, since each step of the drag re-renders.
  const last = useRef<number | null>(null);

  return (
    <div
      className={`notes-edge${upright ? ' upright' : ''}`}
      role="separator"
      aria-label="Notepad size"
      aria-orientation={upright ? 'horizontal' : 'vertical'}
      aria-valuenow={size ?? undefined}
      tabIndex={0}
      title="Drag to make the notepad bigger or smaller; double-click to reset"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const { r } = limits();
        last.current = clamp(upright ? r.bottom - e.clientY : r.right - e.clientX);
        setSize(last.current);
      }}
      onPointerUp={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (last.current !== null) done(last.current);
        last.current = null;
      }}
      onDoubleClick={() => {
        setSize(null);
        done(null);
      }}
      onKeyDown={(e) => {
        // Bigger towards the Bible: left beside it, up below it.
        const step = e.shiftKey ? 80 : 24;
        const grow = upright ? { ArrowUp: step, ArrowDown: -step } : { ArrowLeft: step, ArrowRight: -step };
        const by = grow[e.key as keyof typeof grow];
        if (by === undefined) return;
        e.preventDefault();
        const next = clamp(current() + by);
        setSize(next);
        done(next);
      }}
    />
  );
}
