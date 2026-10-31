import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TOOL_STYLE, compact, strokePath, touches } from '../lib/ink';
import type { Ink, Stroke, Tool } from '../lib/studies';

export type PenTool = Tool | 'eraser';

/**
 * A surface you can write on: whatever it wraps (the passage, a sheet of notes) with
 * ink drawn over it.
 *
 * Who draws:
 *   - Apple Pencil (or any stylus) always draws. Fingers never do: they scroll, tap
 *     words and type, so a palm resting on the glass leaves no marks.
 *   - A mouse draws only while the pen is switched on, so it can still click words.
 * On iPad the Pencil arrives as a touch; its touchstart is cancelled so it does not
 * also scroll the page, focus the notes (raising the keyboard), or start Scribble.
 */
export default function InkSurface({ ink, onChange, tool, mouseDraws, className, children }: {
  ink: Ink | undefined;
  onChange: (ink: Ink) => void;
  tool: PenTool;
  mouseDraws: boolean;
  className?: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<{ stroke: Stroke; real: boolean } | null>(null);
  const [width, setWidth] = useState(0);
  // Set when a pen gesture starts; its trailing click is swallowed, so a Pencil tap on a
  // word writes rather than also marking it. Cleared by the next pointerdown of any kind,
  // so a gesture that ends without a click cannot swallow a later finger tap. This was a
  // 350 ms window after the pen lifted; under load the click arrived later than that and
  // the word was marked anyway (seen in the browser tests run in parallel).
  const penGesture = useRef(false);
  const current = useRef<{ stroke: Stroke; real: boolean; erased: boolean; strokes: Stroke[] } | null>(null);

  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setWidth(Math.round(el.getBoundingClientRect().width)));
    ro.observe(el);
    // Non-passive, so the stylus's default (scroll, focus, Scribble) can be cancelled.
    const stylus = (e: TouchEvent) => {
      if ([...e.touches].some((t) => (t as Touch & { touchType?: string }).touchType === 'stylus')) e.preventDefault();
    };
    el.addEventListener('touchstart', stylus, { passive: false });
    el.addEventListener('touchmove', stylus, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener('touchstart', stylus);
      el.removeEventListener('touchmove', stylus);
    };
  }, []);

  const at = (e: PointerEvent | React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const erase = (strokes: Stroke[], x: number, y: number) => strokes.filter((s) => !touches(s, x, y, 7));

  const down = (e: React.PointerEvent) => {
    const pen = e.pointerType === 'pen';
    penGesture.current = false;
    if (!pen && !(e.pointerType === 'mouse' && mouseDraws && e.button === 0)) return;
    penGesture.current = true;
    e.preventDefault();
    e.stopPropagation();
    try {
      // Keeps the stroke going if the pen leaves the surface mid-line.
      box.current!.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer is already gone (or synthetic); the stroke still draws */
    }
    const [x, y] = at(e);
    const strokes = ink?.strokes ?? [];
    if (tool === 'eraser') {
      const left = erase(strokes, x, y);
      current.current = { stroke: { tool: 'pen', pts: [] }, real: pen, erased: left.length !== strokes.length, strokes: left };
      return;
    }
    const stroke: Stroke = { tool, pts: compact(x, y, pen ? e.pressure || 0.5 : 0.5) };
    current.current = { stroke, real: pen, erased: false, strokes };
    setLive({ stroke, real: pen });
  };

  const move = (e: React.PointerEvent) => {
    const c = current.current;
    if (!c) return;
    // Coalesced events carry every sample since the last frame: without them a quick
    // Pencil stroke comes out as straight segments.
    const samples = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const s of samples.length ? samples : [e.nativeEvent]) {
      const [x, y] = at(s);
      if (tool === 'eraser') {
        const left = erase(c.strokes, x, y);
        if (left.length !== c.strokes.length) {
          c.strokes = left;
          c.erased = true;
        }
      } else {
        c.stroke.pts.push(...compact(x, y, c.real ? s.pressure || 0.5 : 0.5));
      }
    }
    if (tool === 'eraser') {
      if (c.erased) onChange({ width: ink?.width ?? width, strokes: c.strokes });
    } else setLive({ stroke: { ...c.stroke, pts: [...c.stroke.pts] }, real: c.real });
  };

  const up = () => {
    const c = current.current;
    if (!c) return;
    current.current = null;
    setLive(null);
    if (tool !== 'eraser') onChange({ width: ink?.width ?? width, strokes: [...c.strokes, c.stroke] });
  };

  const misaligned = ink && ink.strokes.length > 0 && width > 0 && Math.abs(ink.width - width) > 4;

  return (
    <div
      ref={box}
      className={`ink-surface${className ? ` ${className}` : ''}${mouseDraws ? ' mouse-pen' : ''}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClickCapture={(e) => {
        // A pen tap on a word is writing, not marking it.
        if (penGesture.current) {
          penGesture.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {children}
      <svg className="ink" aria-hidden="true">
        {(ink?.strokes ?? []).map((s, i) => <Path key={i} stroke={s} />)}
        {live && <Path stroke={live.stroke} real={live.real} />}
      </svg>
      {misaligned && (
        <p className="ink-note no-print">
          This ink was written when the page was {ink!.width}px wide and it is now {width}px, so it may not sit on the same
          words. Turning the iPad back lines it up again.
        </p>
      )}
    </div>
  );
}

function Path({ stroke, real }: { stroke: Stroke; real?: boolean }) {
  const s = TOOL_STYLE[stroke.tool];
  return (
    <path
      d={strokePath(stroke, real)}
      style={{ fill: s.color, opacity: s.opacity, mixBlendMode: stroke.tool === 'highlighter' ? 'multiply' : undefined }}
    />
  );
}
