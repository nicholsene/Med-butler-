import type { AppData } from '../repo/types';

export const BACKUP_FORMAT = 'medical-butler-encrypted-backup';
const BUNDLE_APP = 'medical-butler';
const FILE_VERSION = 1;
const SCHEMA_VERSION = 2;

/** OWASP's floor for PBKDF2 with SHA-256. Read back from the file, within these limits. */
export const PBKDF2_ITERATIONS = 600_000;
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 10_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
export const MIN_PASSPHRASE_LENGTH = 10;

export type BackupErrorCode = 'no_passphrase' | 'not_backup' | 'wrong_passphrase' | 'invalid_contents' | 'newer_version' | 'no_crypto';

export const BACKUP_ERROR_TEXT: Record<BackupErrorCode, string> = {
  no_passphrase: 'Please enter the passphrase.',
  not_backup: "This file isn't an encrypted backup from this app. Pick a different file.",
  wrong_passphrase: "That passphrase didn't open this backup. Check it and try again. Your data here hasn't changed.",
  invalid_contents: "This backup opened, but its contents don't look right, so nothing was imported.",
  newer_version: 'This backup came from a newer version of the app. Update the app, then try again.',
  no_crypto: "This browser can't encrypt or decrypt files here. Open the app from its https address or your home screen.",
};

export class BackupError extends Error {
  constructor(readonly code: BackupErrorCode) {
    super(BACKUP_ERROR_TEXT[code]);
    this.name = 'BackupError';
  }
}

export type BackupBundle = {
  app: typeof BUNDLE_APP;
  schema: number;
  exportedAt: string;
  data: AppData;
};

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: number;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string; tagBits: 128 };
  ciphertext: string;
};

export type BackupCounts = Record<keyof Omit<AppData, 'settings' | 'timers'>, number>;

export function makeBundle(data: AppData, now: number): BackupBundle {
  return { app: BUNDLE_APP, schema: SCHEMA_VERSION, exportedAt: new Date(now).toISOString(), data };
}

export function countsOf(data: AppData): BackupCounts {
  return {
    logs: data.logs.length,
    readings: data.readings.length,
    ratings: data.ratings.length,
    questions: data.questions.length,
    prep: data.prep.length,
    shopping: data.shopping.length,
    doctors: data.doctors.length,
    visits: data.visits.length,
    marks: data.marks.length,
  };
}

export const COUNT_LABELS: [keyof BackupCounts, string][] = [
  ['logs', 'Symptom logs'],
  ['readings', 'Readings'],
  ['ratings', 'Step ratings'],
  ['questions', 'Saved questions'],
  ['doctors', 'Doctors'],
  ['visits', 'Visits'],
  ['marks', '"Told my doctor" marks'],
  ['prep', 'Kit items'],
  ['shopping', 'Shopping items'],
];

const toBase64 = (bytes: Uint8Array) => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
};

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new BackupError('no_crypto');
  return s;
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number, usage: KeyUsage): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, [usage]);
}

/** Binds the settings stored beside the ciphertext, so changing any of them fails decryption. */
const headerBytes = (f: Omit<BackupFile, 'ciphertext'>) =>
  new TextEncoder().encode(JSON.stringify([f.format, f.version, f.kdf.name, f.kdf.hash, f.kdf.iterations, f.kdf.salt, f.cipher.name, f.cipher.iv, f.cipher.tagBits]));

/** Salt and IV are new for every backup. The passphrase is used here and kept nowhere. */
export async function encryptBackup(bundle: BackupBundle, passphrase: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  if (!passphrase) throw new BackupError('no_passphrase');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const header: Omit<BackupFile, 'ciphertext'> = {
    format: BACKUP_FORMAT,
    version: FILE_VERSION,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv), tagBits: 128 },
  };
  const key = await deriveKey(passphrase, salt, iterations, 'encrypt');
  const sealed = await subtle().encrypt(
    { name: 'AES-GCM', iv, additionalData: headerBytes(header), tagLength: 128 },
    key,
    new TextEncoder().encode(JSON.stringify(bundle)),
  );
  return JSON.stringify({ ...header, ciphertext: toBase64(new Uint8Array(sealed)) } satisfies BackupFile);
}

/** Rejects anything that isn't a well-formed backup file before spending time on the passphrase. */
export function parseBackupFile(text: string): BackupFile {
  let f: BackupFile;
  try {
    f = JSON.parse(text);
  } catch {
    throw new BackupError('not_backup');
  }
  if (!f || typeof f !== 'object' || f.format !== BACKUP_FORMAT) throw new BackupError('not_backup');
  if (typeof f.version !== 'number' || f.version > FILE_VERSION) throw new BackupError('newer_version');
  const shapeOk =
    f.kdf?.name === 'PBKDF2' &&
    f.kdf.hash === 'SHA-256' &&
    Number.isInteger(f.kdf.iterations) &&
    f.kdf.iterations >= MIN_ITERATIONS &&
    f.kdf.iterations <= MAX_ITERATIONS &&
    typeof f.kdf.salt === 'string' &&
    f.cipher?.name === 'AES-GCM' &&
    f.cipher.tagBits === 128 &&
    typeof f.cipher.iv === 'string' &&
    typeof f.ciphertext === 'string';
  if (!shapeOk) throw new BackupError('not_backup');
  return f;
}

export type OpenedBackup = { bundle: BackupBundle; counts: BackupCounts; exportedAt: number };

/** Decrypts and validates. Touches no stored data, so a failure here can't lose anything. */
export async function openBackup(text: string, passphrase: string): Promise<OpenedBackup> {
  if (!passphrase) throw new BackupError('no_passphrase');
  const file = parseBackupFile(text);
  let plain: ArrayBuffer;
  try {
    const salt = fromBase64(file.kdf.salt);
    const iv = fromBase64(file.cipher.iv);
    const sealed = fromBase64(file.ciphertext);
    const key = await deriveKey(passphrase, salt, file.kdf.iterations, 'decrypt');
    plain = await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: headerBytes(file), tagLength: 128 }, key, sealed);
  } catch (err) {
    if (err instanceof BackupError) throw err;
    // AES-GCM can't tell a wrong passphrase from a damaged file, and both end in the same advice.
    throw new BackupError('wrong_passphrase');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new BackupError('invalid_contents');
  }
  const bundle = validateBundle(parsed);
  return { bundle, counts: countsOf(bundle.data), exportedAt: Date.parse(bundle.exportedAt) };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isBool = (x: unknown): x is boolean => typeof x === 'boolean';
const isStrArr = (x: unknown): x is string[] => Array.isArray(x) && x.every(isStr);
const isNumOrNull = (x: unknown) => x === null || isNum(x);
const isStrOrNull = (x: unknown) => x === null || isStr(x);

const CHECKS: Record<keyof BackupCounts, (x: Record<string, unknown>) => boolean> = {
  logs: (x) => isStr(x.id) && isNum(x.at) && isStrArr(x.chips) && ['mild', 'moderate', 'severe'].includes(x.severity as string) && isBool(x.ateRecently),
  readings: (x) =>
    isStr(x.id) && isNum(x.at) && isNumOrNull(x.systolic) && isNumOrNull(x.diastolic) && isNumOrNull(x.pulse) && isNumOrNull(x.temperature) && isObj(x.symptoms) && isStrOrNull(x.situation) && isStrOrNull(x.cardId),
  ratings: (x) =>
    isStr(x.id) && isStr(x.cardId) && isStr(x.stepId) && ['helped', 'didnt_help', 'made_worse', 'not_now'].includes(x.rating as string) && isNum(x.at) && isStr(x.stepText) && isStr(x.cardTitle) && isBool(x.safety),
  questions: (x) => isStr(x.id) && isStr(x.text) && isNum(x.at) && isStrOrNull(x.cardId),
  prep: (x) => isStr(x.id) && isStr(x.cardId) && isStr(x.location) && isStr(x.item) && isBool(x.have) && isBool(x.custom),
  shopping: (x) => isStr(x.id) && isStr(x.name) && isBool(x.done) && isStrOrNull(x.prepId),
  doctors: (x) => isStr(x.id) && isStr(x.role),
  visits: (x) => isStr(x.id) && isStr(x.doctorId) && isNum(x.at) && isStrArr(x.symptomsDiscussed) && isStr(x.notes) && (x.medications === null || isStrArr(x.medications)),
  marks: (x) => isStr(x.id) && isStr(x.topic) && isNum(x.at) && isStrOrNull(x.doctorId),
};

function settingsOk(s: unknown): boolean {
  if (s === null) return true;
  if (!isObj(s)) return false;
  const phones = s.phones;
  return (
    isBool(s.setupComplete) &&
    isStr(s.name) &&
    isStrArr(s.conditions) &&
    isStrArr(s.medications) &&
    isObj(phones) &&
    isStr(phones.contactA) &&
    isStr(phones.contactB) &&
    isObj(s.thresholds) &&
    isObj(s.labels) &&
    isStrArr(s.customChips)
  );
}

/** Full check of what came out of a backup, so a bad file can never replace good data. */
export function validateBundle(x: unknown): BackupBundle {
  if (!isObj(x) || x.app !== BUNDLE_APP || !isNum(x.schema) || !isStr(x.exportedAt) || Number.isNaN(Date.parse(x.exportedAt))) throw new BackupError('invalid_contents');
  if (x.schema > SCHEMA_VERSION) throw new BackupError('newer_version');
  const d = x.data;
  if (!isObj(d) || !settingsOk(d.settings ?? null) || !isObj(d.timers ?? {})) throw new BackupError('invalid_contents');
  const data = { settings: d.settings ?? null, timers: d.timers ?? {} } as AppData;
  for (const key of Object.keys(CHECKS) as (keyof BackupCounts)[]) {
    const list = d[key];
    if (!Array.isArray(list) || !list.every((item) => isObj(item) && CHECKS[key](item))) throw new BackupError('invalid_contents');
    (data as Record<string, unknown>)[key] = list;
  }
  return { app: BUNDLE_APP, schema: x.schema, exportedAt: x.exportedAt, data };
}

export const BACKUP_REMINDER_DAYS = 7;
const DAY = 86_400_000;

/** True when a gentle nudge is due: never backed up with data on the phone, or the last backup is over 7 days old. */
export function backupReminderDue(lastBackupAt: number | null, hasData: boolean, now: number): boolean {
  if (!hasData) return false;
  return lastBackupAt === null || now - lastBackupAt > BACKUP_REMINDER_DAYS * DAY;
}
