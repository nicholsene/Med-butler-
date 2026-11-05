import { useEffect, useState, type ReactNode } from 'react';
import { backupReminderDue } from '../logic/backup';
import { isStandalone } from '../logic/device';
import { smsHref, telHref } from '../logic/tel';
import { navigate } from '../router';
import type { Voice } from '../repo/types';
import { useApp } from '../state/AppContext';

/** The mockups' mountain and lake scene, in forest green or sunset colors. */
export function Scene({ voice = 'steady', strip = false }: { voice?: Voice; strip?: boolean }) {
  const warm = voice === 'warm';
  const sky = warm ? '#F3C9A5' : '#CFE0CF';
  const far = warm ? '#7F9A7B' : '#8FB09A';
  const ripple = warm ? '#F3C9A5' : '#A8CFC9';
  return (
    <svg
      className={strip ? 'scene scene-strip no-print' : 'scene no-print'}
      aria-hidden="true"
      viewBox="0 0 390 130"
      preserveAspectRatio={strip ? 'none' : 'xMidYMid slice'}
    >
      <rect width="390" height="130" fill={sky} />
      <path d="M0 52 C45 20 90 14 130 38 C170 60 205 8 255 14 C305 20 345 46 390 34 V96 H0 Z" fill={far} />
      <path d="M0 72 C60 38 105 42 150 62 C195 82 235 34 285 40 C330 46 360 66 390 54 V96 H0 Z" fill="#4F7F62" />
      <path d="M0 90 C60 68 110 72 165 84 C220 96 275 66 325 72 C355 76 375 84 390 78 V96 H0 Z" fill="#1F4D3A" />
      {!strip && <path d="M30 84 l7 -18 l7 18 z M58 80 l8 -21 l8 21 z M88 80 l6 -16 l6 16 z M238 86 l6 -16 l6 16 z M300 78 l8 -21 l8 21 z M334 80 l7 -17 l7 17 z" fill="#1F4D3A" />}
      <rect y="96" width="390" height="34" fill="#2E6A6E" />
      {!strip && <path d="M0 96 H390 V102 C300 108 250 100 190 106 C120 112 60 102 0 108 Z" fill="#1F4D3A" fillOpacity="0.55" />}
      <path d="M40 112 H130 M190 118 H300 M90 124 H170 M300 110 H360" stroke={ripple} strokeWidth={strip ? 2 : 1.5} fill="none" />
    </svg>
  );
}

export function Heading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={className} tabIndex={-1} data-route-heading>
      {children}
    </h1>
  );
}

export function BackLink({ to, label = 'Back' }: { to: string; label?: string }) {
  return (
    <a className="back no-print" href={`#${to}`}>
      {label}
    </a>
  );
}

export function VoiceSwitch({ onWhite = false }: { onWhite?: boolean }) {
  const { settings, setVoice } = useApp();
  return (
    <div className={onWhite ? 'switch switch-white no-print' : 'switch no-print'} role="group" aria-label="Voice">
      {(['steady', 'warm'] as const).map((v) => (
        <button key={v} type="button" aria-pressed={settings.voice === v} className={`switch-${v}`} onClick={() => setVoice(v)}>
          {settings.labels[v]}
        </button>
      ))}
    </div>
  );
}

/** A real tel: link that only acts on tap. With no number saved, the same button opens Settings. */
export function CallLink({ who }: { who: 'contactA' | 'contactB' }) {
  const { settings } = useApp();
  const name = settings.labels[who];
  const href = telHref(settings.phones[who]);
  if (href) {
    return (
      <a className="call" href={href}>
        Call {name}
      </a>
    );
  }
  return (
    <a className="call" href="#/settings/phones">
      Call {name}
      <small>Add number in {settings.labels.settings}</small>
    </a>
  );
}

export function CallButtons() {
  return (
    <div className="grid-2 no-print">
      <CallLink who="contactA" />
      <CallLink who="contactB" />
    </div>
  );
}

/** Said wherever messaging appears. */
export const NO_ALERTS = 'This app sends no automatic alerts. Nothing goes to anyone unless you tap, and a text still waits for you to press send.';

/** Opens Messages with the text filled in, for the contacts chosen in Settings. Only a tap does anything. */
export function TextButtons() {
  const { settings } = useApp();
  const chosen = (['contactA', 'contactB'] as const).filter((who) => settings.textContacts[who]);
  if (!chosen.length) return null;
  return (
    <div className="grid-2 no-print">
      {chosen.map((who) => {
        const name = settings.labels[who];
        const href = smsHref(settings.phones[who], settings.emergencyText);
        return href ? (
          <a key={who} className="call" href={href}>
            Text {name}
          </a>
        ) : (
          <a key={who} className="call" href="#/settings/phones">
            Text {name}
            <small>Add number in {settings.labels.settings}</small>
          </a>
        );
      })}
    </div>
  );
}

export function dateText(at: number) {
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** A home screen warning when opened in a browser tab. */
export function HomeScreenWarning() {
  if (isStandalone()) return null;
  return (
    <div className="panel panel-amber no-print" role="note" data-testid="home-screen-warning">
      <p>
        <strong>You're in a browser tab.</strong> Add this app to your home screen and open it from there. A browser can clear data kept in a tab, and on iPhone a tab and the home screen app don't share data.
      </p>
    </div>
  );
}

/** A gentle nudge, never a block. */
export function BackupReminder() {
  const { meta, logs, readings, visits, marks, questions } = useApp();
  const hasData = logs.length + readings.length + visits.length + marks.length + questions.length > 0;
  if (!backupReminderDue(meta.lastBackupAt, hasData, Date.now())) return null;
  return (
    <a className="tile tile-amber no-print" href="#/backup" data-testid="backup-reminder">
      <strong>Time for a backup?</strong>
      <span>{meta.lastBackupAt ? `Your last one was ${dateText(meta.lastBackupAt)}.` : "You haven't made one yet."} It takes about a minute.</span>
    </a>
  );
}

export function BottomNav() {
  const { labels } = useApp().settings;
  const here = location.hash.replace(/^#/, '') || '/';
  const tabs: [string, string][] = [
    ['/', labels.now],
    ['/log', labels.log],
    ['/map', labels.map],
    ['/prep', labels.prep],
  ];
  return (
    <nav className="bottom-nav no-print" aria-label="Main">
      {tabs.map(([to, label]) => {
        const active = to === '/' ? here === '/' : here.startsWith(to);
        return (
          <a key={to} href={`#${to}`} aria-current={active ? 'page' : undefined}>
            {label}
          </a>
        );
      })}
    </nav>
  );
}

export function Toggle({ pressed, onClick, children, className = '' }: { pressed: boolean; onClick(): void; children: ReactNode; className?: string }) {
  return (
    <button type="button" className={`chip ${className}`} aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

/** Add and remove short text items, such as conditions or medications. */
export function ListEditor({ label, items, onChange, addLabel = 'Add' }: { label: string; items: string[]; onChange(next: string[]): void; addLabel?: string }) {
  const [text, setText] = useState('');
  const add = () => {
    const value = text.trim();
    if (value && !items.includes(value)) onChange([...items, value]);
    setText('');
  };
  return (
    <div className="list-editor">
      <label className="field">
        {label}
        <span className="row">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
          />
          <button type="button" className="btn btn-small" onClick={add}>
            {addLabel}
          </button>
        </span>
      </label>
      {items.length > 0 && (
        <ul className="plain-list">
          {items.map((item) => (
            <li key={item}>
              <span>{item}</span>
              <button type="button" className="link-btn" aria-label={`Remove ${item}`} onClick={() => onChange(items.filter((x) => x !== item))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Counts down from a stored end time, so it stays correct if the phone locks or the app reloads. */
export function RecheckTimer({ timerKey, minutes, autoStart = false, children }: { timerKey: string; minutes: number; autoStart?: boolean; children?: ReactNode }) {
  const { timers, setTimer } = useApp();
  const endsAt = timers[timerKey];
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (autoStart && !endsAt) setTimer(timerKey, Date.now() + minutes * 60_000);
    // Starts once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [endsAt]);

  if (!endsAt) {
    return (
      <button type="button" className="btn btn-primary btn-large no-print" onClick={() => setTimer(timerKey, Date.now() + minutes * 60_000)}>
        Start {minutes}-minute timer
      </button>
    );
  }
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  if (left === 0) {
    return (
      <div className="timer no-print" role="status">
        <p className="timer-time">Time to recheck</p>
        {children}
        {!autoStart && (
          <button type="button" className="link-btn" onClick={() => setTimer(timerKey, null)}>
            Clear timer
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="timer no-print">
      <p className="timer-time" role="timer" aria-label={`${Math.ceil(left / 60)} minutes left`}>
        {pad(Math.floor(left / 60))}:{pad(left % 60)}
      </p>
      <p className="muted">Keep this screen open to see it finish. It can't alert you when the app is closed.</p>
      {!autoStart && (
        <button type="button" className="link-btn" onClick={() => setTimer(timerKey, null)}>
          Cancel timer
        </button>
      )}
    </div>
  );
}

export function StatusBanner() {
  const { persistent, storageError, dismissStorageError } = useApp();
  return (
    <>
      {!persistent && (
        <p className="banner no-print" role="alert">
          This browser won't let the app save. Anything you enter will be lost when it closes. Open it from your home screen, or make a backup before closing.
        </p>
      )}
      {storageError && (
        <p className="banner no-print" role="alert">
          {storageError}{' '}
          <button type="button" className="link-btn" onClick={dismissStorageError}>
            OK
          </button>
        </p>
      )}
    </>
  );
}

export const go = navigate;
