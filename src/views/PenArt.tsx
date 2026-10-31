import type { Tool } from '../lib/studies';

/**
 * The paper style's own pen in the toolbar: Darrell's own pens, cut from the family's
 * photographs of them (public/pens/), so they look like the pens he writes with, not
 * drawings of pens. A drawn version came first and wasn't lifelike enough.
 *
 * The three-colour ballpoint's colours are ink dots beside it, each a real button named
 * as the plain pens are ("Black pen"). Sliders drawn onto the photograph never looked
 * right (they floated, or sat on the real ones), so the photograph is left as it is.
 */
const LABEL: Partial<Record<Tool, string>> = { pen: 'Pen', black: 'Black pen', red: 'Red pen', green: 'Green pen' };
const COUNT = ['', 'One', 'Two', 'Three', 'Four'];

export function MultiColourPen({ colours, choice, choose }: { colours: Tool[]; choice: string; choose: (t: Tool) => void }) {
  return (
    <span className="pen-art bic" role="group" aria-label={`${COUNT[colours.length]}-colour pen`}>
      <img className="pen-photo" src="pens/bic-three-colour.webp" alt="" draggable={false} />
      {colours.map((tool) => (
        <button key={tool} type="button" className="tb-icon ink-dot" aria-pressed={choice === tool} aria-label={LABEL[tool]} title={LABEL[tool]} onClick={() => choose(tool)}>
          <span className={`nib nib-${tool}`} aria-hidden="true" />
        </button>
      ))}
    </span>
  );
}

export function FountainPen({ pressed, choose }: { pressed: boolean; choose: () => void }) {
  return (
    <button type="button" className="pen-art fountain" aria-pressed={pressed} aria-label="Pen" title="Pen" onClick={choose}>
      <img className="pen-photo" src="pens/fountain.webp" alt="" draggable={false} />
    </button>
  );
}
