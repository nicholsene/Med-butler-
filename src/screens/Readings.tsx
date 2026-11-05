import { useState } from 'react';
import { BackLink, CallButtons, Heading, RecheckTimer, Toggle, go } from '../components/ui';
import { CARDS, CARD_IDS, ROUTING, cardsForChips } from '../logic/cards';
import { decide, type SymptomKey, type Symptoms } from '../logic/decide';
import { chipChoices, worstOutcome } from '../logic/guides';
import { useApp } from '../state/AppContext';

const QUESTIONS: [SymptomKey, string][] = [
  ['shakySweaty', 'Shaky or sweaty'],
  ['veryHungry', 'Very hungry'],
  ['diarrhea', 'Diarrhea today'],
  ['darkUrine', 'Dark urine'],
  ['vomiting', 'Vomiting today'],
  ['ateRecently', 'Ate in last 2 hours'],
];

const CHOICES = chipChoices(CARDS);

const toNumber = (s: string) => {
  const n = Number(s.trim());
  return s.trim() === '' || !Number.isFinite(n) ? null : n;
};

export function Readings() {
  const { settings, session, setSession, addReading, setTimer } = useApp();
  const rechecking = session.awaitingRecheck;
  const [top, setTop] = useState('');
  const [bottom, setBottom] = useState('');
  const [pulse, setPulse] = useState('');
  const [temp, setTemp] = useState('');
  const [symptoms, setSymptoms] = useState<Symptoms>(rechecking ? session.symptoms : {});
  const [worst, setWorst] = useState<string | null>(null);
  const [error, setError] = useState('');

  const submit = () => {
    const vitals = { systolic: toNumber(top), diastolic: toNumber(bottom), pulse: toNumber(pulse), temperature: toNumber(temp) };
    const decision = decide({ ...vitals, symptoms, alreadyRechecked: rechecking }, settings.thresholds, ROUTING, CARD_IDS);
    // "What feels worst?" only counts when it was picked, and never during a very high recheck.
    const chip = rechecking ? null : worst;
    const outcome = worstOutcome(decision, chip, chip ? cardsForChips([chip]).map((c) => c.id) : []);

    if (decision.kind === 'none' && decision.reason === 'no_input' && !outcome) {
      setError('Enter a reading, or pick what fits or what feels worst. If you can’t, use the call buttons below.');
      return;
    }
    if (decision.kind === 'none' && decision.reason === 'implausible') {
      setError('Those numbers look off. Check that top and bottom are the right way round, or clear them to continue.');
      return;
    }
    const gaveSomething = Object.values(vitals).some((v) => v != null) || Object.values(symptoms).some(Boolean);
    if (gaveSomething) {
      addReading({
        systolic: vitals.systolic,
        diastolic: vitals.diastolic,
        pulse: vitals.pulse,
        temperature: vitals.temperature,
        symptoms,
        situation: decision.situation ?? null,
        cardId: decision.kind === 'card' ? decision.cardId : outcome?.kind === 'card' ? outcome.cardId : null,
      });
    }
    setSession({ vitals, symptoms, decision, awaitingRecheck: decision.kind === 'recheck' });
    if (decision.kind === 'recheck') {
      setTimer('veryHigh', null);
      go('/recheck');
    } else if (decision.kind === 'card') go(`/guide/${encodeURIComponent(decision.cardId)}`);
    else if (outcome?.kind === 'card') go(`/guide/${encodeURIComponent(outcome.cardId)}`);
    else if (outcome?.kind === 'search') go(`/guides/${encodeURIComponent(outcome.query)}`);
    else go('/no-card');
  };

  return (
    <div className="page">
      <main className="stack pad grow">
        <BackLink to="/serious" />
        <Heading>{rechecking ? 'Take it one more time' : 'Sit or lie down first'}</Heading>
        <p className="lead">{rechecking ? 'Enter your second reading.' : 'Then take your blood pressure, if it is safe to reach your cuff.'}</p>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="panel panel-white reading-grid">
            <label className="reading">
              Top
              <input inputMode="numeric" autoComplete="off" value={top} onChange={(e) => setTop(e.target.value)} />
            </label>
            <label className="reading">
              Bottom
              <input inputMode="numeric" autoComplete="off" value={bottom} onChange={(e) => setBottom(e.target.value)} />
            </label>
            <label className="reading">
              Pulse
              <input inputMode="numeric" autoComplete="off" value={pulse} onChange={(e) => setPulse(e.target.value)} />
            </label>
            <label className="reading reading-wide">
              Temperature in °F, optional
              <input inputMode="decimal" autoComplete="off" value={temp} onChange={(e) => setTemp(e.target.value)} />
            </label>
          </div>
          <h2>Which fit right now?</h2>
          <div className="grid-2">
            {QUESTIONS.map(([key, label]) => (
              <Toggle key={key} pressed={Boolean(symptoms[key])} onClick={() => setSymptoms({ ...symptoms, [key]: !symptoms[key] })}>
                {label}
              </Toggle>
            ))}
          </div>
          {!rechecking && (
            <section className="stack-small" aria-labelledby="worst-heading">
              <h2 id="worst-heading">What feels worst?</h2>
              <p className="muted small">Optional. A reading or the answers above come first. This only helps when they don’t point to a guide.</p>
              {worst && (
                <p role="status">
                  Picked: <strong>{worst}</strong>{' '}
                  <button type="button" className="link-btn" onClick={() => setWorst(null)}>
                    Clear
                  </button>
                </p>
              )}
              {CHOICES.map((g) => (
                <details key={g.id} className="panel panel-white">
                  <summary>{g.name}</summary>
                  <div className="grid-2">
                    {g.chips.map(({ chip }) => (
                      <Toggle key={chip} pressed={worst === chip} onClick={() => setWorst(worst === chip ? null : chip)}>
                        {chip}
                      </Toggle>
                    ))}
                  </div>
                </details>
              ))}
            </section>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-large">
            Show my next step
          </button>
        </form>
        <CallButtons />
      </main>
    </div>
  );
}

export function Recheck() {
  const { settings, session } = useApp();
  const minutes = settings.thresholds.veryHighBp.recheckMinutes;
  const v = session.vitals;
  return (
    <div className="page">
      <main className="stack pad grow">
        <BackLink to="/serious" />
        {v && (
          <p className="reading-line">
            {v.systolic ?? '?'}/{v.diastolic ?? '?'}
            {v.pulse != null ? `, pulse ${v.pulse}` : ''}
          </p>
        )}
        <Heading>
          Stay still. Check again in {minutes} {minutes === 1 ? 'minute' : 'minutes'}.
        </Heading>
        <p className="lead">This number is above your very high line. A second reading shows whether it holds.</p>
        <RecheckTimer timerKey="veryHigh" minutes={minutes} autoStart>
          <a className="btn btn-primary btn-large" href="#/readings">
            Enter my second reading
          </a>
        </RecheckTimer>
        <a className="btn btn-red btn-large" href="#/serious">
          Something feels serious
        </a>
        <CallButtons />
      </main>
    </div>
  );
}
