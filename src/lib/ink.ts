import { getStroke } from 'perfect-freehand';
import type { Stroke, Tool } from './studies';

/** How each tool lays down ink. Colors are skin variables, so a skin can recolor but not repurpose them. */
export const TOOL_STYLE: Record<Tool, { size: number; thinning: number; color: string; opacity: number; label: string }> = {
  pen: { size: 2.8, thinning: 0.6, color: 'var(--ink-notes)', opacity: 1, label: 'Pen' },
  red: { size: 2.8, thinning: 0.6, color: 'var(--accent)', opacity: 1, label: 'Red pen' },
  pencil: { size: 2.2, thinning: 0.25, color: 'var(--muted)', opacity: 0.8, label: 'Pencil' },
  highlighter: { size: 18, thinning: 0, color: '#f2d43a', opacity: 0.38, label: 'Highlighter' },
};

/**
 * A stroke's outline as an SVG path. `realPressure` is false for mouse strokes, whose
 * "pressure" is a constant 0.5: perfect-freehand then simulates pressure from speed,
 * so a mouse line still swells and tapers like a pen instead of looking like a wire.
 */
export function strokePath(stroke: Stroke, realPressure = hasPressure(stroke)): string {
  const pts: [number, number, number][] = [];
  for (let i = 0; i < stroke.pts.length; i += 3) pts.push([stroke.pts[i], stroke.pts[i + 1], stroke.pts[i + 2]]);
  const style = TOOL_STYLE[stroke.tool];
  const outline = getStroke(pts, {
    size: style.size,
    thinning: style.thinning,
    smoothing: 0.5,
    streamline: 0.4,
    simulatePressure: !realPressure,
    last: true,
    start: { taper: style.thinning ? 4 : 0, cap: true },
    end: { taper: style.thinning ? 6 : 0, cap: true },
  });
  if (outline.length < 2) return '';
  // Quadratic curves through the midpoints of the outline: smooth, and a fraction of the size of a polyline.
  let d = `M${r(outline[0][0])},${r(outline[0][1])}Q`;
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    d += `${r(x0)},${r(y0)} ${r((x0 + x1) / 2)},${r((y0 + y1) / 2)} `;
  }
  return `${d}Z`;
}

const r = (n: number) => Math.round(n * 10) / 10;

/** Mouse strokes are stored at a constant 0.5; anything else came from a real pen. */
export const hasPressure = (s: Stroke) => s.pts.some((v, i) => i % 3 === 2 && v !== 0.5);

/**
 * True when (x, y) is within `radius` of the stroke: the eraser's hit test. Measured to
 * each segment, not just the sampled points: a quick stroke has points far apart, and
 * the eraser passing between two of them must still catch it.
 */
export function touches(stroke: Stroke, x: number, y: number, radius: number): boolean {
  const pad = radius + TOOL_STYLE[stroke.tool].size / 2;
  const p = stroke.pts;
  if (p.length === 3) return (p[0] - x) ** 2 + (p[1] - y) ** 2 <= pad * pad;
  for (let i = 0; i + 3 < p.length; i += 3) {
    const [ax, ay, bx, by] = [p[i], p[i + 1], p[i + 3], p[i + 4]];
    const len = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = len ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len)) : 0;
    if ((ax + t * (bx - ax) - x) ** 2 + (ay + t * (by - ay) - y) ** 2 <= pad * pad) return true;
  }
  return false;
}

/** Rounds points to half a pixel and pressure to two places: keeps pads small without visible loss. */
export const compact = (x: number, y: number, p: number): [number, number, number] => [
  Math.round(x * 2) / 2,
  Math.round(y * 2) / 2,
  Math.round(p * 100) / 100,
];
