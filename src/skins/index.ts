import daylight from './daylight.json';
import night from './night.json';
import notebook from './notebook.json';
import notebookFountain from './notebook-fountain.json';
import sepia from './sepia.json';

/** Built-in paper styles, by id. Each must pass validateSkin like any other (skin.test.ts checks). */
export const BUILT_IN: Record<string, unknown> = { notebook, 'notebook-fountain': notebookFountain, sepia, daylight, night };

/**
 * "auto" is not a style of its own: it is Daylight or Night, following the device's
 * light or dark setting. Offered on the Paper page; not the default.
 */
export const AUTO = 'auto';
/**
 * Where everyone starts until they choose otherwise: the family's choice. Darrell's own
 * notebook and four-colour pen (2026-10-31; Sepia before). Anyone who chose a style
 * keeps it: only those who never chose see the change.
 */
export const DEFAULT = 'notebook';
export const LIGHT = 'daylight';
export const DARK = 'night';
