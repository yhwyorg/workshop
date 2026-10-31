import type { Tool } from '../lib/studies';

/**
 * The paper style's own pen, drawn as the pen itself in the toolbar: the four-colour
 * ballpoint whose sliders choose the colour, or the fountain pen. Built from shaded
 * shapes (CSS gradients lit from above, as a cylinder is), so each slider is a real
 * button: reachable by keyboard and screen reader, with the same names as the plain
 * pens ("Black pen"), and a hit area as tall as the toolbar, wider than the slider.
 */
export function FourColourPen({ choice, choose }: { choice: string; choose: (t: Tool) => void }) {
  const sliders: [Tool, string][] = [['pen', 'Pen'], ['black', 'Black pen'], ['red', 'Red pen'], ['green', 'Green pen']];
  return (
    <span className="pen-art bic" role="group" aria-label="Four-colour pen">
      <span className="bic-point" aria-hidden="true" />
      <span className="bic-cone" aria-hidden="true" />
      <span className="bic-barrel" aria-hidden="true" />
      <span className="bic-band" aria-hidden="true" />
      <span className="bic-body" aria-hidden="true" />
      <span className="bic-clip" aria-hidden="true" />
      <span className="bic-loop" aria-hidden="true" />
      {sliders.map(([tool, label], i) => (
        <button
          key={tool}
          type="button"
          className={`bic-slider bic-${tool}`}
          style={{ left: 120 + i * 24 }}
          aria-pressed={choice === tool}
          aria-label={label}
          title={label}
          onClick={() => choose(tool)}
        >
          {/* Clicked down: the slider moves toward the point, as the real one does. */}
          <span className="bic-tab" aria-hidden="true" />
        </button>
      ))}
    </span>
  );
}

export function FountainPen({ pressed, choose }: { pressed: boolean; choose: () => void }) {
  return (
    <button type="button" className="pen-art fountain" aria-pressed={pressed} aria-label="Pen" title="Pen" onClick={choose}>
      <span className="fp-nib" aria-hidden="true" />
      <span className="fp-section" aria-hidden="true" />
      <span className="fp-barrel" aria-hidden="true" />
      <span className="fp-ring" aria-hidden="true" />
      <span className="fp-cap" aria-hidden="true" />
      <span className="fp-clip" aria-hidden="true" />
      <span className="fp-finial" aria-hidden="true" />
    </button>
  );
}
