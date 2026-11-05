export type Thresholds = {
  lowBp: { systolicBelow: number; diastolicBelow: number };
  veryHighBp: { systolicAbove: number; diastolicAbove: number; recheckMinutes: number };
  restingPulse: { min: number; max: number };
  guideRecheckMinutes: number;
};

export type Vitals = {
  systolic?: number | null;
  diastolic?: number | null;
  pulse?: number | null;
  /** Recorded for the log only. It never selects a card. */
  temperature?: number | null;
};

export type SymptomKey = 'shakySweaty' | 'veryHungry' | 'diarrhea' | 'darkUrine' | 'vomiting' | 'ateRecently';
export type Symptoms = Partial<Record<SymptomKey, boolean>>;

export type DecideInput = Vitals & {
  symptoms?: Symptoms;
  /** True when this reading is the second one, taken after the very-high recheck wait. */
  alreadyRechecked?: boolean;
};

export type Situation = 'very_high_bp' | 'low_bp_fluid_loss' | 'low_bp' | 'possible_low_sugar' | 'fluid_loss';
export type Flag = 'pulse_high' | 'pulse_low' | 'possible_low_sugar';
export type Routing = Partial<Record<Situation, string>>;

export type Decision =
  | { kind: 'recheck'; situation: 'very_high_bp'; label: string; minutes: number; flags: Flag[] }
  | { kind: 'card'; situation: Situation; cardId: string; label: string; flags: Flag[] }
  | {
      kind: 'none';
      reason: 'no_input' | 'implausible' | 'in_range' | 'no_match' | 'no_card';
      situation?: Situation;
      label?: string;
      flags: Flag[];
    };

export const SITUATION_LABEL: Record<Situation, string> = {
  very_high_bp: 'Very high pressure',
  low_bp_fluid_loss: 'Low pressure, possible fluid loss',
  low_bp: 'Low pressure',
  // There is no glucose reading in this app, so this can only ever be "possible".
  possible_low_sugar: 'Possible low blood sugar',
  fluid_loss: 'Possible fluid loss',
};

const given = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

function isImplausible({ systolic, diastolic, pulse }: Vitals): boolean {
  if (given(systolic) && (systolic < 40 || systolic > 320)) return true;
  if (given(diastolic) && (diastolic < 20 || diastolic > 220)) return true;
  if (given(pulse) && (pulse < 20 || pulse > 260)) return true;
  return given(systolic) && given(diastolic) && diastolic >= systolic;
}

/** Pure. Picks at most one card from readings and symptoms. Temperature is ignored on purpose. */
export function decide(
  input: DecideInput,
  thresholds: Thresholds,
  routing: Routing,
  knownCardIds?: Iterable<string>,
): Decision {
  const { systolic, diastolic, pulse, alreadyRechecked } = input;
  const s = input.symptoms ?? {};
  const anySymptom = Object.values(s).some(Boolean);
  const hasBp = given(systolic) || given(diastolic);

  if (!hasBp && !given(pulse) && !anySymptom) return { kind: 'none', reason: 'no_input', flags: [] };
  if (isImplausible(input)) return { kind: 'none', reason: 'implausible', flags: [] };

  const flags: Flag[] = [];
  if (given(pulse) && pulse > thresholds.restingPulse.max) flags.push('pulse_high');
  if (given(pulse) && pulse < thresholds.restingPulse.min) flags.push('pulse_low');

  const veryHigh =
    (given(systolic) && systolic > thresholds.veryHighBp.systolicAbove) ||
    (given(diastolic) && diastolic > thresholds.veryHighBp.diastolicAbove);
  const low =
    (given(systolic) && systolic < thresholds.lowBp.systolicBelow) ||
    (given(diastolic) && diastolic < thresholds.lowBp.diastolicBelow);
  const fluidLoss = Boolean(s.diarrhea || s.vomiting || s.darkUrine);
  const possibleSugar = Boolean(s.shakySweaty);

  let situation: Situation | null = null;
  if (veryHigh) {
    if (!alreadyRechecked) {
      return {
        kind: 'recheck',
        situation: 'very_high_bp',
        label: SITUATION_LABEL.very_high_bp,
        minutes: thresholds.veryHighBp.recheckMinutes,
        flags,
      };
    }
    situation = 'very_high_bp';
  } else if (low) {
    situation = fluidLoss ? 'low_bp_fluid_loss' : 'low_bp';
  } else if (fluidLoss) {
    // Checked first because the low-sugar guide can't address vomiting. A flag still mentions low sugar.
    situation = 'fluid_loss';
  } else if (possibleSugar) {
    situation = 'possible_low_sugar';
  }

  if (!situation) return { kind: 'none', reason: hasBp ? 'in_range' : 'no_match', flags };
  if (situation !== 'possible_low_sugar' && possibleSugar) flags.push('possible_low_sugar');

  const label = SITUATION_LABEL[situation];
  const cardId = routing[situation];
  const known = knownCardIds ? new Set(knownCardIds) : null;
  if (!cardId || (known && !known.has(cardId))) {
    return { kind: 'none', reason: 'no_card', situation, label, flags };
  }
  return { kind: 'card', situation, cardId, label, flags };
}

/** Returns a list of problems. An empty list means the thresholds are safe to store. */
export function validateThresholds(t: Thresholds): string[] {
  const values = [
    t.lowBp.systolicBelow,
    t.lowBp.diastolicBelow,
    t.veryHighBp.systolicAbove,
    t.veryHighBp.diastolicAbove,
    t.veryHighBp.recheckMinutes,
    t.restingPulse.min,
    t.restingPulse.max,
    t.guideRecheckMinutes,
  ];
  const errors: string[] = [];
  if (values.some((v) => !Number.isFinite(v) || v <= 0)) errors.push('Every value must be a number above zero.');
  if (t.lowBp.systolicBelow >= t.veryHighBp.systolicAbove) errors.push('Low top number must be under the very high top number.');
  if (t.lowBp.diastolicBelow >= t.veryHighBp.diastolicAbove) errors.push('Low bottom number must be under the very high bottom number.');
  if (t.restingPulse.min >= t.restingPulse.max) errors.push('Lowest pulse must be under the highest pulse.');
  return errors;
}
