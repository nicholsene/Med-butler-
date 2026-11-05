import { useState } from 'react';
import { BackLink, Heading, Scene } from '../components/ui';
import { buildBrief } from '../logic/brief';
import { ASSOCIATION_NOTE } from '../logic/patterns';
import { RATING_LABEL } from '../logic/ratings';
import { useApp } from '../state/AppContext';

export function VisitBrief() {
  const { settings, logs, readings, ratings, questions, addQuestion, removeQuestion } = useApp();
  const [text, setText] = useState('');
  const brief = buildBrief({ logs, readings, ratings, questions }, settings.thresholds, Date.now());
  const add = () => {
    if (text.trim()) addQuestion(text.trim());
    setText('');
  };

  return (
    <div className="page page-white brief">
      <Scene voice={settings.voice} strip />
      <main className="stack pad grow">
        <BackLink to="/" />
        <Heading>Your {settings.labels.brief}</Heading>
        <p className="print-only small">
          {settings.name && `${settings.name}. `}Prepared {new Date().toLocaleDateString()}.
        </p>

        <section>
          <h2>Top questions</h2>
          {brief.questions.length === 0 && <p className="muted">No questions saved yet.</p>}
          <ol className="question-list">
            {brief.questions.map((q) => (
              <li key={q.id}>
                <span>{q.text}</span>
                <button type="button" className="link-btn no-print" aria-label={`Remove question: ${q.text}`} onClick={() => removeQuestion(q.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ol>
          <label className="field no-print">
            Add a question
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
                Add
              </button>
            </span>
          </label>
        </section>

        <section>
          <h2>Last 30 days</h2>
          {brief.counts.length === 0 && <p className="muted">Nothing logged in the last 30 days.</p>}
          <div className="grid-2 stat-grid">
            {brief.counts.map((c) => (
              <div className="stat" key={c.label}>
                <p className="stat-num">{c.count}</p>
                <p>{c.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>Patterns to discuss</h2>
          {brief.patterns.length === 0 ? (
            <p className="muted">Not enough logged yet to show patterns.</p>
          ) : (
            <>
              <ul>
                {brief.patterns.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    {p.headline} {p.detail}
                  </li>
                ))}
              </ul>
              <p className="muted small">{ASSOCIATION_NOTE}</p>
            </>
          )}
        </section>

        <section>
          <h2>What helped and what didn't</h2>
          {brief.worse.length + brief.otherRatings.length === 0 && <p className="muted">No guide steps rated yet.</p>}
          {brief.worse.length > 0 && (
            <div className="panel panel-amber">
              <h3>Flagged: made it worse</h3>
              <ul>
                {brief.worse.map((r) => (
                  <li key={r.id}>
                    {r.stepText} <span className="small">({r.cardTitle})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {brief.otherRatings.length > 0 && (
            <ul>
              {brief.otherRatings.map((r) => (
                <li key={r.id}>
                  {RATING_LABEL[r.rating]}: {r.stepText} <span className="small">({r.cardTitle})</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>Conditions and medications</h2>
          <p>Conditions: {settings.conditions.join(', ') || 'none added'}</p>
          <p>Medications: {settings.medications.join(', ') || 'none added'}</p>
        </section>

        <a className="inline-link no-print" href="#/gaps">
          See what may be worth raising
        </a>
        <button type="button" className="btn btn-primary btn-large no-print" onClick={() => window.print()}>
          Export one-page PDF
        </button>
        <p className="muted small">Counted from your own log. Not reviewed by a doctor, and not a diagnosis.</p>
      </main>
    </div>
  );
}
