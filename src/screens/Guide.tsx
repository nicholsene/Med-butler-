import { useState } from 'react';
import type { Card, CardStep, Sourced } from '../data/card.types';
import { BackLink, CallButtons, Heading, RecheckTimer, Scene, VoiceSwitch } from '../components/ui';
import { cardSourceIds, getCard, ROUTING, SOURCES } from '../logic/cards';
import type { Decision, Flag, Thresholds, Vitals } from '../logic/decide';
import { applyRatings, latestByStep, RATING_LABEL, type RatingValue } from '../logic/ratings';
import { useApp } from '../state/AppContext';

const RATINGS: RatingValue[] = ['helped', 'didnt_help', 'made_worse', 'not_now'];

function vitalsLine(v: Vitals | null) {
  if (!v) return null;
  const parts: string[] = [];
  if (v.systolic != null || v.diastolic != null) parts.push(`${v.systolic ?? '?'}/${v.diastolic ?? '?'}`);
  if (v.pulse != null) parts.push(`pulse ${v.pulse}`);
  if (v.temperature != null) parts.push(`${v.temperature}°F`);
  return parts.join(', ') || null;
}

function flagText(flag: Flag, t: Thresholds) {
  const range = `${t.restingPulse.min} to ${t.restingPulse.max}`;
  if (flag === 'pulse_high') return `Your pulse is above your resting range of ${range}.`;
  if (flag === 'pulse_low') return `Your pulse is below your resting range of ${range}.`;
  return 'You said shaky or sweaty, so low blood sugar is possible. This app can’t measure it.';
}

function Flags({ flags, t }: { flags: Flag[]; t: Thresholds }) {
  if (!flags.length) return null;
  return (
    <ul className="flags">
      {flags.map((f) => (
        <li key={f}>{flagText(f, t)}</li>
      ))}
    </ul>
  );
}

function Unverified() {
  return <span className="unverified"> (source not rechecked yet)</span>;
}

function Items({ items }: { items: Sourced[] }) {
  if (items.length === 1)
    return (
      <p>
        {items[0].text}
        {items[0].unverified && <Unverified />}
      </p>
    );
  return (
    <ul>
      {items.map((i) => (
        <li key={i.text}>
          {i.text}
          {i.unverified && <Unverified />}
        </li>
      ))}
    </ul>
  );
}

const reportsText = (n: number) => `${n} patient ${n === 1 ? 'report' : 'reports'}`;

function StepRow({ card, step }: { card: Card; step: CardStep }) {
  const { settings, ratings, rateStep } = useApp();
  const [open, setOpen] = useState(false);
  const current = latestByStep(ratings, card.id).get(step.id)?.rating;
  return (
    <li className="step">
      {step.safety && <span className="tag">Safety step</span>}
      <p className="step-text">
        {step[settings.voice]}
        {step.unverified && <Unverified />}
      </p>
      <button type="button" className="link-btn no-print" aria-expanded={open} onClick={() => setOpen(!open)}>
        {current ? `You said: ${RATING_LABEL[current]}` : 'How did this go?'}
      </button>
      {open && (
        <div className="grid-2 rating-grid" role="group" aria-label="Rate this step">
          {RATINGS.map((r) => (
            <button
              key={r}
              type="button"
              className="chip"
              aria-pressed={current === r}
              onClick={() => {
                rateStep(card, step, r);
                setOpen(false);
              }}
            >
              {RATING_LABEL[r]}
            </button>
          ))}
        </div>
      )}
      {open && step.safety && <p className="muted small">Your rating is saved for your doctor. This safety step stays where it is.</p>}
    </li>
  );
}

export function Guide({ cardId }: { cardId: string }) {
  const { settings, session, ratings, questions, saveCardQuestions, clearStepRatings } = useApp();
  const card = getCard(cardId);

  if (!card) return <NoCard />;

  const warm = settings.voice === 'warm';
  const decision: Decision | null = session.decision?.kind === 'card' && session.decision.cardId === card.id ? session.decision : null;
  const { visible, hidden } = applyRatings(card, ratings);
  const line = decision ? vitalsLine(session.vitals) : null;
  const minutes = settings.thresholds.guideRecheckMinutes;
  const reviewed = card.status === 'doctor_reviewed';
  const saved = questions.filter((q) => q.cardId === card.id && !q.dismissed);

  return (
    <div className={warm ? 'page guide guide-warm' : 'page guide'}>
      <Scene voice={settings.voice} strip />
      <main className="stack pad">
        <div className="row-between">
          <BackLink to="/" />
          <VoiceSwitch onWhite />
        </div>
        <div>
          {line && <p className="reading-line">{line}</p>}
          <Heading>{card.title}</Heading>
          {decision && decision.kind === 'card' && <p className="fits">{decision.label}</p>}
          <p className="fits">
            {decision ? 'This fits your answers. ' : ''}
            {decision ? 'It is' : 'This is'} not a diagnosis{warm ? ', and it makes sense if you feel worn out.' : '.'}
          </p>
          {!reviewed && <p className="tag tag-review">Not yet reviewed by your doctor</p>}
          {card.evidence.strength === 'thin' && (
            <p className="tag tag-review" data-testid="thin-evidence">
              Thin evidence: {card.evidence.reportCount === 0 ? 'no patient reports' : reportsText(card.evidence.reportCount)} behind this guide
            </p>
          )}
          {card.evidence.strength !== 'thin' && (
            <p className="muted small">
              Evidence: {card.evidence.strength}, from {reportsText(card.evidence.reportCount)}.
            </p>
          )}
        </div>

        {/* Emergency items come first on every card, in both voices, in the same words. */}
        <section className="panel panel-emergency" aria-labelledby="emergency-heading" data-testid="emergency-block">
          <h2 id="emergency-heading">Get emergency help if</h2>
          <Items items={card.emergency} />
          <a className="btn btn-red" href="tel:911">
            Call 911
          </a>
        </section>

        {decision && <Flags flags={decision.flags} t={settings.thresholds} />}

        <ol className="steps">
          {visible.map((step) => (
            <StepRow key={step.id} card={card} step={step} />
          ))}
        </ol>

        {hidden.length > 0 && (
          <section className="panel panel-white no-print">
            <h2>Hidden for this guide</h2>
            <p className="small">These made things worse. They're flagged on your {settings.labels.brief}.</p>
            <ul className="plain-list">
              {hidden.map((s) => (
                <li key={s.id}>
                  <span>{s[settings.voice]}</span>
                  <button type="button" className="link-btn" onClick={() => clearStepRatings(card.id, s.id)}>
                    Show again
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* The very high guide has its own wait (1 minute, in its first step), so the general timer would contradict it. */}
        {card.id !== ROUTING.very_high_bp && (
          <RecheckTimer timerKey={`guide:${card.id}`} minutes={minutes}>
            <a className="btn btn-primary" href="#/readings">
              Take my reading again
            </a>
          </RecheckTimer>
        )}

        {card.avoid.length > 0 && (
          <section className="panel panel-white">
            <h2>Avoid</h2>
            <Items items={card.avoid} />
          </section>
        )}
        {card.callDoctor.length > 0 && (
          <section className="panel panel-amber">
            <h2>Call your doctor if</h2>
            <Items items={card.callDoctor} />
          </section>
        )}
        {saved.length > 0 ? (
          <section className="panel panel-white">
            <h2>{warm ? "You don't have to remember this" : 'Saved for your doctor'}</h2>
            <ul>
              {saved.map((q) => (
                <li key={q.id}>{q.text}</li>
              ))}
            </ul>
            <a className="inline-link" href="#/brief">
              See your {settings.labels.brief}
            </a>
          </section>
        ) : (
          card.doctorQuestions.length > 0 && (
            <details className="panel panel-white no-print">
              <summary>Questions you could ask your doctor ({card.doctorQuestions.length})</summary>
              <ul>
                {card.doctorQuestions.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
              <button type="button" className="btn btn-primary" onClick={() => saveCardQuestions(card)}>
                Save these for my doctor
              </button>
            </details>
          )
        )}

        <CallButtons />

        {card.conflicts.length > 0 && (
          <details className="panel panel-white" data-testid="conflicts">
            <summary>
              Ask your doctor about this conflict<span className="muted small">&nbsp;({card.conflicts.length})</span>
            </summary>
            <p className="muted small">Sources disagree or leave a gap here. A doctor can say what applies to you.</p>
            <ul className="small">
              {card.conflicts.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </details>
        )}
        {card.patientIdeas.length > 0 && (
          <details className="panel panel-white" data-testid="patient-ideas">
            <summary>
              Others have asked about<span className="muted small">&nbsp;({card.patientIdeas.length})</span>
            </summary>
            <p className="muted small">These are patient reports, not advice. They are questions to bring to a doctor.</p>
            <ul className="small">
              {card.patientIdeas.map((p) => (
                <li key={p.text}>
                  {p.text} ({reportsText(p.reportCount)})
                </li>
              ))}
            </ul>
          </details>
        )}

        <footer className="sources">
          {!reviewed && <strong>Not yet reviewed by your doctor. </strong>}
          {warm ? 'Same sources and steps as ' + settings.labels.steady + '. Sources: ' : 'Sources: '}
          <ul>
            {cardSourceIds(card).map((id) => {
              const s = SOURCES[id];
              return <li key={id}>{s ? <a href={s.url}>{s.title}</a> : id}</li>;
            })}
          </ul>
        </footer>
      </main>
    </div>
  );
}

/** Shown when decide() has no card, or a link points at a card id that isn't in cards.json. */
export function NoCard() {
  const { settings, session } = useApp();
  const d = session.decision;
  const reason = d?.kind === 'none' ? d.reason : 'no_card';
  const line = vitalsLine(session.vitals);
  const title =
    reason === 'in_range'
      ? "Your numbers don't match a guide"
      : reason === 'no_match'
        ? "This doesn't match a guide"
        : "There's no guide for this yet";
  return (
    <div className="page">
      <main className="stack pad grow">
        <BackLink to="/" />
        {line && d && <p className="reading-line">{line}</p>}
        <Heading>{title}</Heading>
        {d?.kind === 'none' && d.label && <p className="lead">It looks closest to: {d.label.toLowerCase()}. This is not a diagnosis.</p>}
        <p className="lead">That doesn't mean nothing is wrong. If this still feels wrong, call someone or your doctor.</p>
        {d && <Flags flags={d.flags} t={settings.thresholds} />}
        <CallButtons />
        <a className="btn btn-outline" href="#/serious">
          Go back to the emergency check
        </a>
        <a className="btn btn-primary" href="#/guides">
          Find a guide
        </a>
        <a className="btn btn-outline" href="#/log">
          {settings.labels.logThis}
        </a>
      </main>
    </div>
  );
}
