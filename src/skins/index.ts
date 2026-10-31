import chalkboard from './chalkboard.json';
import legalPad from './legal-pad.json';
import nightStudy from './night-study.json';
import studyDesk from './study-desk.json';

/** Built-in skins, by id. Each must pass validateSkin like any other (skin.test.ts checks). */
export const BUILT_IN: Record<string, unknown> = {
  'legal-pad': legalPad,
  'study-desk': studyDesk,
  'night-study': nightStudy,
  chalkboard,
};

export const DEFAULT_SKIN = 'legal-pad';
