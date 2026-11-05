import { useState } from 'react';
import { BackLink, Heading, dateText, go } from '../components/ui';
import {
  BACKUP_ERROR_TEXT,
  BackupError,
  COUNT_LABELS,
  countsOf,
  encryptBackup,
  makeBundle,
  MIN_PASSPHRASE_LENGTH,
  openBackup,
  type OpenedBackup,
} from '../logic/backup';
import { dayStamp, deliverFile, jsonFile, type DeliverResult } from '../logic/share';
import { useApp } from '../state/AppContext';

const errorText = (err: unknown) => (err instanceof BackupError ? BACKUP_ERROR_TEXT[err.code] : "That didn't work. Your data here hasn't changed. Please try again.");
const DELIVER_TEXT: Record<DeliverResult, string> = {
  shared: 'Backup shared. Keep it somewhere other than this phone.',
  downloaded: 'Backup saved to your downloads. Keep it somewhere other than this phone.',
  cancelled: 'Not saved yet. Your encrypted file is still ready below.',
  failed: "That didn't work. Please try again.",
};

function CreateBackup() {
  const { readAllData, markBackedUp } = useApp();
  const [pass, setPass] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState<{ file: File; at: number } | null>(null);
  const [result, setResult] = useState<DeliverResult | null>(null);

  const encrypt = async () => {
    if (!pass) return setError('Please enter a passphrase.');
    if (pass.length < MIN_PASSPHRASE_LENGTH) return setError(`Please use at least ${MIN_PASSPHRASE_LENGTH} characters. A short sentence works well.`);
    if (pass !== again) return setError("Those two passphrases don't match.");
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const now = Date.now();
      const text = await encryptBackup(makeBundle(await readAllData(), now), pass);
      setReady({ file: jsonFile(`butler-backup-${dayStamp(now)}.enc.json`, text), at: now });
      // Gone from the screen as soon as it's done its job.
      setPass('');
      setAgain('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  // Its own tap, because browsers refuse to share a file after slow work like encryption.
  const deliver = async () => {
    if (!ready) return;
    const outcome = await deliverFile(ready.file);
    setResult(outcome);
    if (outcome === 'shared' || outcome === 'downloaded') markBackedUp(ready.at);
  };

  return (
    <section className="panel panel-white stack-small">
      <h2>Make an encrypted backup</h2>
      <p className="small">
        Includes everything in the app. It can only be opened with your passphrase, which is never saved anywhere. <strong>If you forget it, the backup can't be opened by anyone.</strong>
      </p>
      {!ready ? (
        <>
          <label className="field">
            Passphrase
            <input type="password" autoComplete="new-password" data-testid="backup-pass" value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          <label className="field">
            Same passphrase again
            <input type="password" autoComplete="new-password" data-testid="backup-pass-again" value={again} onChange={(e) => setAgain(e.target.value)} />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void encrypt()}>
            {busy ? 'Encrypting…' : 'Encrypt my data'}
          </button>
        </>
      ) : (
        <>
          <p className="small" role="status">
            Encrypted. Now save it somewhere other than this phone, such as iCloud Drive or an email to yourself.
          </p>
          <button type="button" className="btn btn-primary" data-testid="backup-deliver" onClick={() => void deliver()}>
            Save or share the backup file
          </button>
          {result && (
            <p className="muted small" role="status" data-testid="backup-result">
              {DELIVER_TEXT[result]}
            </p>
          )}
          <button
            type="button"
            className="btn btn-outline-thin"
            onClick={() => {
              setReady(null);
              setResult(null);
            }}
          >
            Start over
          </button>
        </>
      )}
    </section>
  );
}

function RestoreBackup() {
  const { readAllData, restoreData } = useApp();
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [opened, setOpened] = useState<OpenedBackup | null>(null);
  const [current, setCurrent] = useState<ReturnType<typeof countsOf> | null>(null);

  const reset = () => {
    setOpened(null);
    setCurrent(null);
    setPass('');
    setError('');
  };

  const open = async () => {
    if (text === null) return setError('Please choose a backup file first.');
    if (!pass) return setError('Please enter the passphrase for this backup.');
    setBusy(true);
    setError('');
    try {
      const result = await openBackup(text, pass);
      setCurrent(countsOf(await readAllData()));
      setOpened(result);
      setPass('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const replace = async () => {
    if (!opened) return;
    setBusy(true);
    const ok = await restoreData(opened.bundle.data, opened.exportedAt);
    setBusy(false);
    if (ok) go('/');
    else setError("That backup couldn't be saved, so your data here wasn't changed.");
  };

  return (
    <section className="panel panel-white stack-small">
      <h2>Restore from a backup</h2>
      {!opened ? (
        <>
          <label className="field">
            Backup file
            <input
              type="file"
              data-testid="restore-file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                setError('');
                setText(file ? await file.text() : null);
                setFileName(file?.name ?? '');
              }}
            />
          </label>
          {fileName && <p className="small muted">Chosen: {fileName}</p>}
          <label className="field">
            Passphrase for this backup
            <input type="password" autoComplete="off" data-testid="restore-pass" value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          {error && (
            <p className="error" role="alert" data-testid="restore-error">
              {error}
            </p>
          )}
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void open()}>
            {busy ? 'Opening…' : 'Open backup'}
          </button>
          <p className="muted small">Opening a backup changes nothing. You'll see what's in it first.</p>
        </>
      ) : (
        <div className="stack-small" role="alertdialog" aria-label="Confirm restore" data-testid="restore-preview">
          <p>
            <strong>This backup is from {dateText(opened.exportedAt)}.</strong>
          </p>
          <table className="count-table">
            <thead>
              <tr>
                <th></th>
                <th>In backup</th>
                <th>On phone now</th>
              </tr>
            </thead>
            <tbody>
              {COUNT_LABELS.map(([key, label]) => (
                <tr key={key}>
                  <td>{label}</td>
                  <td>{opened.counts[key]}</td>
                  <td>{current?.[key] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="panel panel-amber small">Restoring replaces everything on this phone with this backup. Anything newer here will be lost.</p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="btn btn-red" disabled={busy} onClick={() => void replace()}>
            Yes, replace everything
          </button>
          <button type="button" className="btn btn-outline-thin" onClick={reset}>
            Cancel and keep what's here
          </button>
        </div>
      )}
    </section>
  );
}

function PlainExport() {
  const { logs, readings, ratings, questions, prep, shopping, timers, doctors, visits, marks, settings } = useApp();
  const [agreed, setAgreed] = useState(false);
  const [result, setResult] = useState('');

  const run = async () => {
    const now = Date.now();
    const bundle = makeBundle({ settings, logs, readings, ratings, questions, prep, shopping, timers, doctors, visits, marks }, now);
    const outcome = await deliverFile(jsonFile(`butler-unencrypted-${dayStamp(now)}.json`, JSON.stringify(bundle, null, 2)));
    setResult(outcome === 'failed' ? "That didn't work. Please try again." : outcome === 'cancelled' ? '' : 'Unencrypted file ready. Please delete it when you are done with it.');
  };

  return (
    <details className="panel panel-white">
      <summary>Export without encryption</summary>
      <div className="stack-small">
        <p className="panel panel-amber small">
          <strong>Not protected.</strong> This file holds your health details, name and phone numbers in plain text. Anyone or any app that gets it can read all of it. It can't be restored here either. Use an encrypted backup unless you need to read the raw data yourself.
        </p>
        <label className="check-row">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} data-testid="plain-agree" />I understand this file isn't protected
        </label>
        <button type="button" className="btn btn-danger-outline" disabled={!agreed} data-testid="plain-export" onClick={() => void run()}>
          Export plain JSON
        </button>
        {result && (
          <p className="muted small" role="status">
            {result}
          </p>
        )}
      </div>
    </details>
  );
}

export function Backup() {
  const { meta, settings } = useApp();
  return (
    <div className="page">
      <main className="stack pad grow">
        <BackLink to={settings.setupComplete ? '/settings' : '/'} />
        <Heading>Backup</Heading>
        <p>Your data lives only on this phone, so a lost phone or a cleared browser would lose it. A backup you keep elsewhere is the only copy.</p>
        <p data-testid="last-backup">
          <strong>Last backup:</strong> {meta.lastBackupAt ? dateText(meta.lastBackupAt) : 'none yet'}
        </p>
        <CreateBackup />
        <RestoreBackup />
        <PlainExport />
      </main>
    </div>
  );
}
