import { useEffect, useState } from 'react';
import { BackLink, BackupReminder, Heading, HomeScreenWarning, ListEditor, NO_ALERTS, VoiceSwitch, dateText, go } from '../components/ui';
import { DEFAULT_EMERGENCY_TEXT, DEFAULT_LABELS, DEFAULT_THRESHOLDS } from '../data/defaults';
import { CARD_ERRORS } from '../logic/cards';
import { validateThresholds, type Thresholds } from '../logic/decide';
import { PERSIST_TEXT } from '../logic/device';
import { telHref } from '../logic/tel';
import type { Labels } from '../repo/types';
import { useApp } from '../state/AppContext';

const LABEL_FIELDS: [keyof Labels, string][] = [
  ['serious', 'Emergency button'],
  ['logThis', 'Log button'],
  ['now', 'Now tab'],
  ['log', 'Log tab'],
  ['map', 'Map tab'],
  ['prep', 'Prep tab'],
  ['brief', 'Visit Brief'],
  ['gaps', 'Doctor Gap Review'],
  ['visits', 'Visits and doctors'],
  ['settings', 'Settings'],
  ['steady', 'First voice'],
  ['warm', 'Second voice'],
  ['contactA', 'First person to call'],
  ['contactB', 'Second person to call'],
];

type Path = [keyof Thresholds, string?];
const THRESHOLD_FIELDS: [string, Path][] = [
  ['Low: top number below', ['lowBp', 'systolicBelow']],
  ['Low: bottom number below', ['lowBp', 'diastolicBelow']],
  ['Very high: top number above', ['veryHighBp', 'systolicAbove']],
  ['Very high: bottom number above', ['veryHighBp', 'diastolicAbove']],
  ['Very high: recheck after (minutes)', ['veryHighBp', 'recheckMinutes']],
  ['Resting pulse: lowest', ['restingPulse', 'min']],
  ['Resting pulse: highest', ['restingPulse', 'max']],
  ['Guide recheck timer (minutes)', ['guideRecheckMinutes']],
];

const readPath = (t: Thresholds, [a, b]: Path) => String(b ? (t[a] as unknown as Record<string, number>)[b] : t[a]);

function setPath(t: Thresholds, [a, b]: Path, value: number): Thresholds {
  const next = structuredClone(t) as unknown as Record<string, unknown>;
  if (b) (next[a] as Record<string, number>)[b] = value;
  else next[a] = value;
  return next as unknown as Thresholds;
}

function ThresholdsForm() {
  const { settings, updateSettings } = useApp();
  const toForm = (t: Thresholds) => THRESHOLD_FIELDS.map(([, path]) => readPath(t, path));
  const [values, setValues] = useState(() => toForm(settings.thresholds));
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const save = () => {
    const next = THRESHOLD_FIELDS.reduce((t, [, path], i) => setPath(t, path, values[i].trim() === '' ? Number.NaN : Number(values[i])), settings.thresholds);
    const problems = validateThresholds(next);
    setErrors(problems);
    setSaved(problems.length === 0);
    if (!problems.length) updateSettings({ thresholds: next });
  };

  return (
    <section className="panel panel-white stack-small">
      <h2>Thresholds</h2>
      <p className="small">These decide which guide you see. Change them only if your doctor gives you different numbers.</p>
      {THRESHOLD_FIELDS.map(([label], i) => (
        <label className="field field-inline" key={label}>
          {label}
          <input
            inputMode="numeric"
            value={values[i]}
            onChange={(e) => {
              setSaved(false);
              setValues(values.map((v, j) => (j === i ? e.target.value : v)));
            }}
          />
        </label>
      ))}
      {errors.map((e) => (
        <p className="error" role="alert" key={e}>
          {e}
        </p>
      ))}
      {saved && (
        <p className="muted small" role="status">
          Saved.
        </p>
      )}
      <button type="button" className="btn btn-primary" onClick={save}>
        Save thresholds
      </button>
      <button
        type="button"
        className="btn btn-outline-thin"
        onClick={() => {
          setValues(toForm(DEFAULT_THRESHOLDS));
          setErrors([]);
          setSaved(false);
          updateSettings({ thresholds: structuredClone(DEFAULT_THRESHOLDS) });
        }}
      >
        Reset to defaults
      </button>
    </section>
  );
}

function EmergencyTextForm() {
  const { settings, updateSettings } = useApp();
  const [text, setText] = useState(settings.emergencyText);
  const [saved, setSaved] = useState(false);
  return (
    <section className="panel panel-white stack-small" id="emergency-text">
      <h2>Emergency text</h2>
      <p className="small" data-testid="no-alerts">{NO_ALERTS}</p>
      <p className="small">Choose who gets a text button on the Call 911 screen.</p>
      {(['contactA', 'contactB'] as const).map((who) => (
        <label className="check-row" key={who}>
          <input
            type="checkbox"
            checked={settings.textContacts[who]}
            onChange={(e) => updateSettings({ textContacts: { ...settings.textContacts, [who]: e.target.checked } })}
          />
          {settings.labels[who]}
        </label>
      ))}
      <label className="field">
        Message filled in for you
        <textarea
          rows={3}
          value={text}
          onChange={(e) => {
            setSaved(false);
            setText(e.target.value);
          }}
        />
      </label>
      {saved && (
        <p className="muted small" role="status">
          Saved.
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          const clean = text.trim() || DEFAULT_EMERGENCY_TEXT;
          setText(clean);
          updateSettings({ emergencyText: clean });
          setSaved(true);
        }}
      >
        Save message
      </button>
    </section>
  );
}

export function SettingsScreen({ focus }: { focus?: string }) {
  const { settings, updateSettings, deleteAllData, persistStatus, askToPersist, meta } = useApp();
  const [phones, setPhones] = useState(settings.phones);
  const [name, setName] = useState(settings.name);
  const [labels, setLabels] = useState(settings.labels);
  const [notice, setNotice] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (focus) document.getElementById(focus)?.scrollIntoView();
  }, [focus]);

  const say = (key: string, text: string) => setNotice((n) => ({ ...n, [key]: text }));
  const phoneProblem = (['contactA', 'contactB'] as const).some((k) => phones[k].trim() && !telHref(phones[k]));

  return (
    <div className="page">
      <main className="stack pad grow">
        <BackLink to="/" />
        <Heading>{settings.labels.settings}</Heading>

        <section className="panel panel-white stack-small" id="phones">
          <h2>Phone numbers</h2>
          {(['contactA', 'contactB'] as const).map((k) => (
            <label className="field" key={k}>
              {settings.labels[k]}
              <input
                type="tel"
                autoComplete="off"
                value={phones[k]}
                onChange={(e) => {
                  say('phones', '');
                  setPhones({ ...phones, [k]: e.target.value });
                }}
              />
            </label>
          ))}
          {phoneProblem && (
            <p className="error" role="alert">
              One of these doesn't look like a phone number.
            </p>
          )}
          {notice.phones && (
            <p className="muted small" role="status">
              {notice.phones}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={phoneProblem}
            onClick={() => {
              updateSettings({ phones });
              say('phones', 'Saved.');
            }}
          >
            Save numbers
          </button>
        </section>

        <EmergencyTextForm />

        <section className="panel panel-white stack-small">
          <h2>Voice</h2>
          <VoiceSwitch />
        </section>

        <ThresholdsForm />

        <section className="panel panel-white stack-small" id="details">
          <h2>My details</h2>
          <label className="field">
            What should we call you?
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => updateSettings({ name: name.trim() })}
            />
          </label>
          <ListEditor label="Conditions" items={settings.conditions} onChange={(conditions) => updateSettings({ conditions })} />
          <ListEditor label="Medications" items={settings.medications} onChange={(medications) => updateSettings({ medications })} />
          <ListEditor label="Extra log chips" items={settings.customChips} onChange={(customChips) => updateSettings({ customChips })} />
        </section>

        <section className="panel panel-white stack-small">
          <h2>Rename labels</h2>
          {LABEL_FIELDS.map(([key, label]) => (
            <label className="field" key={key}>
              {label}
              <input value={labels[key]} onChange={(e) => setLabels({ ...labels, [key]: e.target.value })} />
            </label>
          ))}
          {notice.labels && (
            <p className="muted small" role="status">
              {notice.labels}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              // A blank label falls back to its default, so no button ends up empty.
              const clean = Object.fromEntries(LABEL_FIELDS.map(([k]) => [k, labels[k].trim() || DEFAULT_LABELS[k]])) as Labels;
              setLabels(clean);
              updateSettings({ labels: clean });
              say('labels', 'Saved.');
            }}
          >
            Save labels
          </button>
          <button
            type="button"
            className="btn btn-outline-thin"
            onClick={() => {
              setLabels({ ...DEFAULT_LABELS });
              updateSettings({ labels: { ...DEFAULT_LABELS } });
              say('labels', 'Back to the original labels.');
            }}
          >
            Reset labels
          </button>
        </section>

        <section className="panel panel-white stack-small">
          <h2>Your data</h2>
          <p className="small">Everything is stored only on this phone.</p>
          <p className="small" role="status" data-testid="persist-status">
            <strong>Storage:</strong> {PERSIST_TEXT[persistStatus]}
          </p>
          {(persistStatus === 'denied' || persistStatus === 'unknown') && (
            <button type="button" className="btn btn-outline-thin" onClick={() => void askToPersist()}>
              Ask the browser again
            </button>
          )}
          <p className="small" data-testid="last-backup">
            <strong>Last backup:</strong> {meta.lastBackupAt ? dateText(meta.lastBackupAt) : 'none yet'}
          </p>
          <BackupReminder />
          <HomeScreenWarning />
          <a className="btn btn-primary" href="#/backup">
            Back up or restore
          </a>
          <a className="btn btn-outline-thin" href="#/deep-review">
            Make a deep review file
          </a>
          {!confirming ? (
            <button type="button" className="btn btn-danger-outline" onClick={() => setConfirming(true)}>
              Delete all data
            </button>
          ) : (
            <div className="panel panel-emergency stack-small" role="alertdialog" aria-label="Confirm delete">
              <h3>Delete everything?</h3>
              <p>This removes your logs, readings, ratings, visits, kits, phone numbers and details from this phone. It can't be undone.</p>
              <button
                type="button"
                className="btn btn-red"
                onClick={async () => {
                  if (await deleteAllData()) go('/');
                  else setConfirming(false);
                }}
              >
                Yes, delete everything
              </button>
              <button type="button" className="btn btn-outline-thin" onClick={() => setConfirming(false)}>
                Keep my data
              </button>
            </div>
          )}
        </section>

        {CARD_ERRORS.length > 0 && (
          <section className="panel panel-amber">
            <h2>Guides skipped</h2>
            <p className="small">
              {CARD_ERRORS.length} {CARD_ERRORS.length === 1 ? 'guide was' : 'guides were'} left out because of a problem in the data.
            </p>
            <ul className="small">
              {CARD_ERRORS.map((e) => (
                <li key={e.id}>
                  {e.id}: {e.errors.join('; ')}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
