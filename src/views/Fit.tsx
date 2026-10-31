import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Lays its content out at one fixed width and scales the result to the room there is,
 * as a page is zoomed rather than reflowed.
 *
 * Ink is stored in the pixels of the text it was written on. Reflowing the text to a
 * narrower column (to make room for a reference, or a smaller notepad) would move every
 * word out from under it; scaling moves the words and the ink together. InkSurface
 * divides by the same scale when it reads the pen, so new ink lands under the pen.
 *
 * Off (a phone), the content simply takes the width it is given, as before.
 */
export default function Fit({ width, gutter, max = 1, on, onScale, children }: {
  /** The width the content is laid out at, in CSS pixels. */
  width: number;
  /** Space kept clear either side, in screen pixels. */
  gutter: number;
  /** The most it may be enlarged. */
  max?: number;
  on: boolean;
  /** Told the scale whenever it changes (1 when off). */
  onScale?: (scale: number) => void;
  children: ReactNode;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, room: 0, height: 0 });

  useLayoutEffect(() => {
    onScale?.(on ? fit.scale : 1);
  }, [on, fit.scale, onScale]);

  useLayoutEffect(() => {
    if (!on) return;
    const measure = () => {
      const room = outer.current!.clientWidth;
      const scale = Math.max(0.1, Math.min(max, (room - gutter * 2) / width));
      const height = inner.current!.offsetHeight * scale;
      // Sub-pixel changes are ignored, so a measurement can't feed back into itself.
      setFit((f) => (Math.abs(f.scale - scale) < 0.001 && Math.abs(f.room - room) < 0.5 && Math.abs(f.height - height) < 0.5 ? f : { scale, room, height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer.current!);
    ro.observe(inner.current!);
    return () => ro.disconnect();
  }, [on, width, gutter, max]);

  return (
    <div ref={outer} className={`fit${on ? ' on' : ''}`} style={on ? { height: fit.height } : undefined}>
      <div
        ref={inner}
        className="fit-inner"
        style={on ? { width, transform: `scale(${fit.scale})`, left: (fit.room - width * fit.scale) / 2 } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
