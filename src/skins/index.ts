import daylight from './daylight.json';
import night from './night.json';
import sepia from './sepia.json';

/** Built-in paper styles, by id. Each must pass validateSkin like any other (skin.test.ts checks). */
export const BUILT_IN: Record<string, unknown> = { daylight, night, sepia };

/**
 * "auto" is not a style of its own: it is Daylight or Night, following the device's
 * light or dark setting. Offered on the Paper page; not the default.
 */
export const AUTO = 'auto';
/** Where everyone starts until they choose otherwise: the family's choice. */
export const DEFAULT = 'sepia';
export const LIGHT = 'daylight';
export const DARK = 'night';
