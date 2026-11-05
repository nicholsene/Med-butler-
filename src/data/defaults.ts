import thresholds from './thresholds.json';
import type { Thresholds } from '../logic/decide';
import type { Labels, Settings } from '../repo/types';

export const DEFAULT_THRESHOLDS = thresholds as Thresholds;

export const DEFAULT_LABELS: Labels = {
  now: 'Now',
  log: 'Log',
  map: 'Map',
  prep: 'Prep',
  brief: 'Visit Brief',
  gaps: 'Doctor Gap Review',
  visits: 'Visits and doctors',
  settings: 'Settings',
  serious: 'This feels serious',
  logThis: 'Log this',
  steady: 'Steady',
  warm: 'Warm',
  contactA: 'Contact 1',
  contactB: 'Contact 2',
};

/** Generic on purpose: it says nothing about why, and it opens in Messages for her to edit and send. */
export const DEFAULT_EMERGENCY_TEXT = 'I may need help right now. Please call me.';

/** No names or health details here on purpose. They are entered on the phone at setup. */
export function defaultSettings(): Settings {
  return {
    setupComplete: false,
    name: '',
    conditions: [],
    medications: [],
    phones: { contactA: '', contactB: '' },
    thresholds: structuredClone(DEFAULT_THRESHOLDS),
    voice: 'steady',
    labels: { ...DEFAULT_LABELS },
    customChips: [],
    textContacts: { contactA: true, contactB: true },
    emergencyText: DEFAULT_EMERGENCY_TEXT,
  };
}

/** Fills in anything an older saved copy doesn't have yet. */
export function withDefaults(saved: Settings | null): Settings {
  const base = defaultSettings();
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    phones: { ...base.phones, ...saved.phones },
    textContacts: { ...base.textContacts, ...saved.textContacts },
    labels: { ...base.labels, ...saved.labels },
    thresholds: { ...base.thresholds, ...saved.thresholds },
  };
}
