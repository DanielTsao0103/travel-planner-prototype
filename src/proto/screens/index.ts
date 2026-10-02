/** All screens, in page order. Each page folder owns its own list (./pNN.ts). */

import { screens as p01 } from './p01';
import { screens as p02 } from './p02';
import { screens as p03 } from './p03';
import { screens as p04 } from './p04';
import { screens as p05 } from './p05';
import { screens as p06 } from './p06';
import { screens as p07 } from './p07';
import { screens as p08 } from './p08';
import { screens as p09 } from './p09';
import { screens as p10 } from './p10';
import { screens as p11 } from './p11';
import { screens as p12 } from './p12';
import { screens as p13 } from './p13';
import { screens as p15 } from './p15';
import { screens as p16 } from './p16';
import { screens as p17 } from './p17';
import type { ScreenEntry } from './types';

export const ALL_SCREENS: ScreenEntry[] = [...p01, ...p02, ...p03, ...p04, ...p05, ...p06, ...p07, ...p08, ...p09, ...p10, ...p11, ...p12, ...p13, ...p15, ...p16, ...p17];

export const PAGE_NAMES: Record<number, string> = {
  1: 'Log in & create an account',
  2: 'Connect accounts',
  3: 'Connection flow',
  4: 'Home',
  5: 'Existing trips',
  6: 'Create & edit a trip',
  7: 'Add an event',
  8: 'Day-by-day itinerary',
  9: 'Suggestions',
  10: 'Active-trip dashboard',
  11: 'Day detail',
  12: 'Budget & reimbursements',
  13: 'Collaborators, preferences & permissions',
  14: 'Not defined in the source document',
  15: 'Preferences survey',
  16: 'Nearby suggestion pop-up',
  17: 'Map',
};

export type { ScreenEntry };
