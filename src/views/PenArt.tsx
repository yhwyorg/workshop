import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Tool } from '../lib/studies';

/**
 * The paper style's own pen in the toolbar: Darrell's own pens, cut from the family's
 * photographs of them (public/pens/), so they look like the pens he writes with, not
 * drawings of pens. A drawn version came first and wasn't lifelike enough.
 *
 * The three-colour ballpoint's colours are ink dots beside it, each a real button named
 * as the plain pens are ("Black pen"). Sliders drawn onto the photograph never looked
 * right (they floated, or sat on the real ones), so the photograph is left as it is.
 *
 * The pen can be picked up out of the toolbar and laid anywhere (StudyView keeps where);
 * while it is out, an empty slot here puts it back.
 */
const LABEL: Partial<Record<Tool, string>> = { pen: 'Pen', black: 'Black pen', red: 'Red pen', green: 'Green pen' };
const COUNT = ['', 'One', 'Two', 'Three', 'Four'];
export const PEN_PHOTO = { 'multi-colour': 'pens/bic-three-colour.webp', fountain: 'pens/fountain.webp' } as const;

/** Where the pen is: in the toolbar, or out on the page (with an empty slot to put it back). */
interface Movable {
  out: boolean;
  pickUp: (e: ReactPointerEvent<HTMLElement>) => void;
  putBack: () => void;
}

function Slot({ putBack }: { putBack: () => void }) {
  return (
    <button type="button" className="pen-slot" onClick={putBack} aria-label="Put the pen back" title="Put the pen back">
      <span aria-hidden="true">Put the pen back</span>
    </button>
  );
}

export function MultiColourPen({ colours, choice, choose, out, pickUp, putBack }: { colours: Tool[]; choice: string; choose: (t: Tool) => void } & Movable) {
  return (
    <span className="pen-art bic" role="group" aria-label={`${COUNT[colours.length]}-colour pen`}>
      {out ? (
        <Slot putBack={putBack} />
      ) : (
        <img
          className="pen-photo pen-grab" src={PEN_PHOTO['multi-colour']} alt="" draggable={false}
          title="Drag to lay the pen on the page" onPointerDown={pickUp}
        />
      )}
      {colours.map((tool) => (
        <button key={tool} type="button" className="tb-icon ink-dot" aria-pressed={choice === tool} aria-label={LABEL[tool]} title={LABEL[tool]} onClick={() => choose(tool)}>
          <span className={`nib nib-${tool}`} aria-hidden="true" />
        </button>
      ))}
    </span>
  );
}

export function FountainPen({ pressed, choose, out, pickUp, putBack }: { pressed: boolean; choose: () => void } & Movable) {
  if (out) return <Slot putBack={putBack} />;
  return (
    <button
      type="button" className="pen-art fountain pen-grab" aria-pressed={pressed} aria-label="Pen" title="Pen (drag to lay it on the page)"
      onClick={choose} onPointerDown={pickUp}
    >
      <img className="pen-photo" src={PEN_PHOTO.fountain} alt="" draggable={false} />
    </button>
  );
}
