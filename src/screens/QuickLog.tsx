import { useState } from 'react';
import { ToldButton } from '../components/ToldButton';
import { BottomNav, Heading, Scene, Toggle } from '../components/ui';
import { cardsForChips, logChips } from '../logic/cards';
import type { LogEntry, Severity } from '../repo/types';
import { useApp } from '../state/AppContext';

const SEVERITIES: [Severity, string][] = [
  ['mild', 'Mild'],
  ['moderate', 'Moderate'],
  ['severe', 'Severe'],
];

export const timeText = (at: number) =>
  new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function QuickLog() {
  const { settings, logs, addLog, deleteLog, updateSettings } = useApp();
  const [chips, setChips] = useState<string[]>([]);
  const [severity, setSeverity] = useState<Severity>('moderate');
  const [ate, setAte] = useState(false);
  const [voiceNote, setVoiceNote] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<LogEntry | null>(null);
  const [custom, setCustom] = useState('');

  const toggle = (chip: string) => setChips(chips.includes(chip) ? chips.filter((c) => c !== chip) : [...chips, chip]);
  const addCustom = () => {
    const value = custom.trim();
    if (!value) return;
    if (!logChips(settings.customChips).includes(value)) updateSettings({ customChips: [...settings.customChips, value] });
    if (!chips.includes(value)) setChips([...chips, value]);
    setCustom('');
  };
  const save = () => {
    if (!chips.length) {
      setError('Pick at least one so there is something to save.');
      return;
    }
    setSaved(addLog({ chips, severity, ateRecently: ate }));
    setChips([]);
    setAte(false);
    setSeverity('moderate');
    setError('');
  };
  const related = saved ? cardsForChips(saved.chips) : [];
  const recent = [...logs].sort((a, b) => b.at - a.at).slice(0, 5);

  return (
    <div className="page">
      <Scene voice={settings.voice} strip />
      <main className="stack pad grow">
        <Heading>What's happening?</Heading>
        <button type="button" className="btn btn-voice" onClick={() => setVoiceNote(true)}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
          Say it instead
        </button>
        {voiceNote && (
          <p className="muted small" role="status">
            Voice logging isn't ready yet. Tap below for now.
          </p>
        )}
        <div className="grid-2">
          {logChips(settings.customChips).map((chip) => (
            <Toggle key={chip} pressed={chips.includes(chip)} onClick={() => toggle(chip)}>
              {chip}
            </Toggle>
          ))}
        </div>
        <label className="field">
          Something else?
          <span className="row">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <button type="button" className="btn btn-small" onClick={addCustom}>
              Add
            </button>
          </span>
        </label>
        <Toggle pressed={ate} onClick={() => setAte(!ate)}>
          Ate in last 2 hours
        </Toggle>
        <div>
          <h2>How strong is it?</h2>
          <div className="grid-3">
            {SEVERITIES.map(([value, label]) => (
              <Toggle key={value} className="chip-dark" pressed={severity === value} onClick={() => setSeverity(value)}>
                {label}
              </Toggle>
            ))}
          </div>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="btn btn-primary btn-large" onClick={save}>
          Save
        </button>
        <p className="muted small center">Time saved automatically. Add details later, or never.</p>

        {saved && (
          <section className="panel panel-white" role="status">
            <h2>Saved at {new Date(saved.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</h2>
            <p>
              {saved.chips.join(', ')}. {saved.severity[0].toUpperCase() + saved.severity.slice(1)}.
            </p>
            {related.map((card) => (
              <a key={card.id} className="inline-link" href={`#/guide/${encodeURIComponent(card.id)}`}>
                See guide: {card.title}
              </a>
            ))}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                deleteLog(saved.id);
                setSaved(null);
              }}
            >
              Undo
            </button>
          </section>
        )}

        {recent.length > 0 && (
          <section>
            <h2>Recent</h2>
            <ul className="plain-list">
              {recent.map((l) => (
                <li key={l.id}>
                  <span>
                    {l.chips.join(', ')}
                    <br />
                    <span className="muted small">
                      {timeText(l.at)}, {l.severity}
                    </span>
                  </span>
                  <span className="row-actions">
                    <ToldButton topics={l.chips} />
                    <button type="button" className="link-btn" aria-label={`Remove log from ${timeText(l.at)}`} onClick={() => deleteLog(l.id)}>
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
