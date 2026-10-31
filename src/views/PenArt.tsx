import type { Tool } from '../lib/studies';

/**
 * The paper style's own pen, drawn as the pen itself in the toolbar: the multi-colour
 * ballpoint whose sliders choose the colour (Darrell's blue three-colour BIC), or the
 * fountain pen. Built from shaded
 * shapes (CSS gradients lit from above, as a cylinder is), so each slider is a real
 * button: reachable by keyboard and screen reader, with the same names as the plain
 * pens ("Black pen"), and a hit area as tall as the toolbar, wider than the slider.
 */
const LABEL: Partial<Record<Tool, string>> = { pen: 'Pen', black: 'Black pen', red: 'Red pen', green: 'Green pen' };
const COUNT = ['', 'One', 'Two', 'Three', 'Four'];

/** A multi-colour ballpoint, with a slider for each of its colours: Darrell's has three. */
export function MultiColourPen({ colours, choice, choose }: { colours: Tool[]; choice: string; choose: (t: Tool) => void }) {
  // The sliders sit across the white body, evenly spaced however many there are.
  const gap = colours.length > 3 ? 24 : 28;
  const start = 120 + (100 - 14 - gap * (colours.length - 1)) / 2 - 5;
  return (
    <span className="pen-art bic" role="group" aria-label={`${COUNT[colours.length]}-colour pen`}>
      <span className="bic-point" aria-hidden="true" />
      <span className="bic-cone" aria-hidden="true" />
      <span className="bic-barrel" aria-hidden="true" />
      <span className="bic-band" aria-hidden="true" />
      <span className="bic-body" aria-hidden="true" />
      <span className="bic-clip" aria-hidden="true" />
      <span className="bic-loop" aria-hidden="true" />
      {colours.map((tool, i) => (
        <button
          key={tool}
          type="button"
          className={`bic-slider bic-${tool}`}
          style={{ left: start + i * gap }}
          aria-pressed={choice === tool}
          aria-label={LABEL[tool]}
          title={LABEL[tool]}
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
