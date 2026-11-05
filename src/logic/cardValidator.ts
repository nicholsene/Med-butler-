import type { Card, SourceMap } from '../data/card.types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isTextArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isText);

function checkSources(where: string, value: unknown, sources: SourceMap | undefined, errors: string[]) {
  if (!isTextArray(value) || value.length === 0) {
    errors.push(`${where} has no sources`);
    return;
  }
  if (!sources) return;
  for (const id of value) if (!(id in sources)) errors.push(`${where} cites unknown source "${id}"`);
}

/** Returns the problems with one raw card. An empty list means it is safe to show. */
export function validateCard(raw: unknown, sources?: SourceMap): string[] {
  if (!isObj(raw)) return ['card is not an object'];
  const errors: string[] = [];
  for (const key of ['id', 'title', 'group'] as const) if (!isText(raw[key])) errors.push(`${key} is missing`);
  for (const key of ['chips', 'doctorQuestions', 'prepItems', 'conflicts'] as const) {
    if (!isTextArray(raw[key])) errors.push(`${key} must be a list of text`);
  }

  if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
    errors.push('steps must be a non-empty list');
  } else {
    const seen = new Set<unknown>();
    raw.steps.forEach((step: unknown, i: number) => {
      const where = `step ${i + 1}`;
      if (!isObj(step)) return void errors.push(`${where} is not an object`);
      if (!isText(step.id)) errors.push(`${where} id is missing`);
      if (seen.has(step.id)) errors.push(`${where} repeats id "${String(step.id)}"`);
      seen.add(step.id);
      if (!isText(step.steady)) errors.push(`${where} has no steady text`);
      if (!isText(step.warm)) errors.push(`${where} has no warm text`);
      if (step.unverified !== undefined && typeof step.unverified !== 'boolean') errors.push(`${where} unverified must be true or false`);
      if (typeof step.safety !== 'boolean') errors.push(`${where} safety must be true or false`);
      checkSources(where, step.sources, sources, errors);
    });
  }

  for (const key of ['avoid', 'callDoctor', 'emergency'] as const) {
    const list = raw[key];
    if (!Array.isArray(list)) {
      errors.push(`${key} must be a list`);
      continue;
    }
    list.forEach((item: unknown, i: number) => {
      const where = `${key} ${i + 1}`;
      if (!isObj(item) || !isText(item.text)) return void errors.push(`${where} has no text`);
      if (item.unverified !== undefined && typeof item.unverified !== 'boolean') errors.push(`${where} unverified must be true or false`);
      checkSources(where, item.sources, sources, errors);
    });
    if (key === 'emergency' && list.length === 0) errors.push('emergency must have at least one item');
  }

  if (!Array.isArray(raw.patientIdeas) || !raw.patientIdeas.every((p: unknown) => isObj(p) && isText(p.text) && typeof p.reportCount === 'number')) {
    errors.push('patientIdeas must be a list of {text, reportCount}');
  }
  const ev = raw.evidence;
  if (!isObj(ev) || typeof ev.reportCount !== 'number' || !['thin', 'moderate', 'substantial'].includes(String(ev.strength))) {
    errors.push('evidence must be {reportCount, strength}');
  }
  if (!['source_checked', 'doctor_reviewed'].includes(String(raw.status))) errors.push('status is not recognised');
  return errors;
}

/** Splits raw JSON into cards that may be shown and problems to report. Never throws. */
export function validateCards(raw: unknown, sources?: SourceMap) {
  const valid: Card[] = [];
  const errors: { id: string; errors: string[] }[] = [];
  if (!Array.isArray(raw)) return { valid, errors: [{ id: '(file)', errors: ['cards file is not a list'] }] };
  // The id list must be unique. The first card with an id is kept and later ones are reported.
  const ids = new Set<string>();
  raw.forEach((card: unknown, i: number) => {
    const id = isObj(card) && isText(card.id) ? card.id.trim() : `#${i + 1}`;
    const problems = validateCard(card, sources);
    if (ids.has(id)) problems.push('duplicate card id');
    ids.add(id);
    if (problems.length) errors.push({ id, errors: problems });
    else valid.push(card as Card);
  });
  return { valid, errors };
}
