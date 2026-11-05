import { describe, expect, it } from 'vitest';
import {
  backupReminderDue,
  BackupError,
  encryptBackup,
  makeBundle,
  openBackup,
  parseBackupFile,
  PBKDF2_ITERATIONS,
  validateBundle,
  type BackupErrorCode,
} from './backup';
import { defaultSettings } from '../data/defaults';
import type { AppData } from '../repo/types';

const FAST = 100_000; // Lowest the reader accepts. Keeps tests quick.
const PASS = 'correct horse battery';
const DAY = 86_400_000;

const data = (): AppData => ({
  settings: { ...defaultSettings(), setupComplete: true, name: 'SAMPLE' },
  timers: {},
  logs: [{ id: 'l1', at: 1, chips: ['SAMPLE symptom'], severity: 'mild', ateRecently: false }],
  readings: [],
  ratings: [],
  questions: [{ id: 'q1', text: 'SAMPLE question', at: 2, cardId: null }],
  prep: [],
  shopping: [],
  doctors: [{ id: 'd1', role: 'Primary care' }],
  visits: [{ id: 'v1', doctorId: 'd1', at: 3, symptomsDiscussed: ['SAMPLE symptom'], notes: '', medications: null }],
  marks: [{ id: 'm1', topic: 'SAMPLE symptom', at: 4, doctorId: null }],
});

const failsWith = async (p: Promise<unknown>, code: BackupErrorCode) => {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(BackupError);
  expect((err as BackupError).code).toBe(code);
};

describe('encrypted backup', () => {
  it('round trips all data and counts it', async () => {
    const original = makeBundle(data(), Date.UTC(2030, 0, 2));
    const opened = await openBackup(await encryptBackup(original, PASS, FAST), PASS);
    expect(opened.bundle).toEqual(original);
    expect(opened.counts).toMatchObject({ logs: 1, questions: 1, doctors: 1, visits: 1, marks: 1, readings: 0 });
    expect(opened.exportedAt).toBe(Date.UTC(2030, 0, 2));
  });
  it('defaults to high iterations and records them', async () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
    const file = parseBackupFile(await encryptBackup(makeBundle(data(), 1), PASS));
    expect(file.kdf.iterations).toBe(PBKDF2_ITERATIONS);
  });
  it('holds no readable data, and never the passphrase', async () => {
    const text = await encryptBackup(makeBundle(data(), 1), PASS, FAST);
    for (const secret of ['SAMPLE', 'Primary', PASS]) expect(text).not.toContain(secret);
    const inner = atob(parseBackupFile(text).ciphertext);
    expect(inner).not.toContain('SAMPLE');
  });
  it('uses a new salt and IV every time', async () => {
    const a = parseBackupFile(await encryptBackup(makeBundle(data(), 1), PASS, FAST));
    const b = parseBackupFile(await encryptBackup(makeBundle(data(), 1), PASS, FAST));
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.iv).not.toBe(b.cipher.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(atob(a.kdf.salt)).toHaveLength(16);
    expect(atob(a.cipher.iv)).toHaveLength(12);
  });
  it('gives a clear error for a wrong passphrase', async () => {
    const text = await encryptBackup(makeBundle(data(), 1), PASS, FAST);
    await failsWith(openBackup(text, 'not the passphrase'), 'wrong_passphrase');
  });
  it('requires a passphrase both ways', async () => {
    await failsWith(encryptBackup(makeBundle(data(), 1), ''), 'no_passphrase');
    await failsWith(openBackup(await encryptBackup(makeBundle(data(), 1), PASS, FAST), ''), 'no_passphrase');
  });
  it('rejects changed ciphertext', async () => {
    const f = parseBackupFile(await encryptBackup(makeBundle(data(), 1), PASS, FAST));
    const c = f.ciphertext;
    const flipped = (c[0] === 'A' ? 'B' : 'A') + c.slice(1);
    await failsWith(openBackup(JSON.stringify({ ...f, ciphertext: flipped }), PASS), 'wrong_passphrase');
  });
  it('rejects a changed header, even when the salt and passphrase still work', async () => {
    const f = parseBackupFile(await encryptBackup(makeBundle(data(), 1), PASS, FAST));
    await failsWith(openBackup(JSON.stringify({ ...f, version: 0 }), PASS), 'wrong_passphrase');
  });
  it.each([
    ['not json'],
    ['{}'],
    ['[]'],
    ['null'],
    ['{"format":"something-else"}'],
    ['{"exportedAt":"2030-01-01","app":"medical-butler","version":1,"logs":[]}'],
  ])('says %s is not a backup', async (text) => {
    await failsWith(openBackup(text, PASS), 'not_backup');
  });
  it('refuses a very low or absurd iteration count', async () => {
    const f = parseBackupFile(await encryptBackup(makeBundle(data(), 1), PASS, FAST));
    expect(() => parseBackupFile(JSON.stringify({ ...f, kdf: { ...f.kdf, iterations: 10 } }))).toThrow(BackupError);
    expect(() => parseBackupFile(JSON.stringify({ ...f, kdf: { ...f.kdf, iterations: 1e12 } }))).toThrow(BackupError);
  });
  it('asks for an update when the file is from a newer version', async () => {
    const f = parseBackupFile(await encryptBackup(makeBundle(data(), 1), PASS, FAST));
    await failsWith(openBackup(JSON.stringify({ ...f, version: 99 }), PASS), 'newer_version');
  });
});

describe('validateBundle', () => {
  const good = () => JSON.parse(JSON.stringify(makeBundle(data(), 1)));
  it('accepts a good bundle, and a bundle with no settings', () => {
    expect(validateBundle(good()).data.logs).toHaveLength(1);
    const noSettings = good();
    noSettings.data.settings = null;
    expect(validateBundle(noSettings).data.settings).toBeNull();
  });
  it.each<[string, (b: ReturnType<typeof good>) => void]>([
    ['a missing list', (b) => delete b.data.logs],
    ['a list of the wrong type', (b) => (b.data.logs = 'nope')],
    ['a log with a bad severity', (b) => (b.data.logs[0].severity = 'huge')],
    ['a log without a date', (b) => delete b.data.logs[0].at],
    ['a visit with a bad medication list', (b) => (b.data.visits[0].medications = 'x')],
    ['settings of the wrong shape', (b) => (b.data.settings.conditions = 5)],
    ['the wrong app', (b) => (b.app = 'other')],
    ['a bad date', (b) => (b.exportedAt = 'soon')],
  ])('rejects %s', (_name, breakIt) => {
    const b = good();
    breakIt(b);
    expect(() => validateBundle(b)).toThrow(BackupError);
  });
});

describe('backupReminderDue', () => {
  const now = 100 * DAY;
  it('stays quiet with nothing to back up', () => expect(backupReminderDue(null, false, now)).toBe(false));
  it('reminds when never backed up', () => expect(backupReminderDue(null, true, now)).toBe(true));
  it('stays quiet within 7 days', () => expect(backupReminderDue(now - 7 * DAY, true, now)).toBe(false));
  it('reminds after 7 days', () => expect(backupReminderDue(now - 7 * DAY - 1, true, now)).toBe(true));
});
