import { describe, expect, it } from 'vitest';
import { compact, strokePath, touches } from './ink';
import type { Stroke } from './studies';

const line: Stroke = { tool: 'pen', pts: [0, 0, 0.5, 20, 0, 0.6, 40, 0, 0.7, 60, 0, 0.6] };

describe('ink', () => {
  it('turns points into a closed, filled outline', () => {
    const d = strokePath(line);
    expect(d).toMatch(/^M[\d.-]+,[\d.-]+Q.*Z$/);
    // An outline, not the centre line: it must have width on both sides.
    const ys = [...d.matchAll(/,(-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(1);
  });

  it('draws a single tap as a dot rather than nothing', () => {
    expect(strokePath({ tool: 'pen', pts: [5, 5, 0.5] })).not.toBe('');
  });

  it('erases only strokes the eraser actually touches', () => {
    expect(touches(line, 30, 3, 4)).toBe(true);
    expect(touches(line, 30, 40, 4)).toBe(false);
  });

  it('keeps stored points small', () => {
    expect(compact(10.26, 3.74, 0.4567)).toEqual([10.5, 3.5, 0.46]);
  });
});
