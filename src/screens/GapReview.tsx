import { useMemo } from 'react';
import { ToldButton } from '../components/ToldButton';
import { BackLink, Heading, dateText } from '../components/ui';
import { computeGaps, GAP_LABEL, LOOKBACK_DAYS, symptomRows, type GapItem } from '../logic/gaps';
import { useApp } from '../state/AppContext';

function GapCard({ item }: { item: GapItem }) {
  const { questions, addQuestion } = useApp();
  const added = questions.some((q) => q.gapId === item.id && !q.dismissed);
  return (
    <article className="panel panel-white gap-item" data-testid="gap-item" data-kind={item.kind}>
      <span className="tag">{GAP_LABEL[item.kind]}</span>
      <p className="gap-title">{item.title}</p>
      <p>{item.summary}</p>
      <ul className="evidence">
        {item.evidence.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="gap-actions">
        {added ? (
          <span className="small muted" role="status">
            In your Visit Brief
          </span>
        ) : (
          <button type="button" className="btn btn-small" onClick={() => addQuestion(item.briefText, item.id)}>
            Add to Visit Brief
          </button>
        )}
        <ToldButton key={item.id} topics={[item.topic]} doctorIds={item.doctorIds} />
      </div>
    </article>
  );
}

export function GapReview() {
  const { settings, logs, readings, ratings, doctors, visits, marks } = useApp();
  const now = Date.now();
  const items = useMemo(
    () => computeGaps({ logs, readings, ratings, doctors, visits, marks, medications: settings.medications, thresholds: settings.thresholds }, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs, readings, ratings, doctors, visits, marks, settings.medications, settings.thresholds],
  );
  const rows = symptomRows({ logs, readings, visits, marks, thresholds: settings.thresholds }, now);

  return (
    <div className="page">
      <main className="stack pad grow">
        <BackLink to="/" />
        <Heading>{settings.labels.gaps}</Heading>
        <p>
          Worked out on this phone by comparing what you logged with the visits and marks you saved here. It only knows what's saved here, not what any doctor knows. Nothing is sent anywhere.
        </p>
        {!visits.length && !marks.length && (
          <p className="panel panel-amber">
            No visits saved yet, so everything you've logged may show below. <a href="#/visits">Add a visit</a> to make this more useful.
          </p>
        )}

        {items.length === 0 ? (
          <p className="panel panel-white" data-testid="no-gaps">
            Nothing to raise from what's saved here right now.
          </p>
        ) : (
          <section className="stack" aria-label="May be worth raising">
            <h2>May be worth raising ({items.length})</h2>
            {items.map((item) => (
              <GapCard key={item.id} item={item} />
            ))}
          </section>
        )}

        {rows.length > 0 && (
          <section className="panel panel-white">
            <h2>Told a doctor about something?</h2>
            <p className="small">Symptoms from the last {LOOKBACK_DAYS} days.</p>
            <ul className="plain-list">
              {rows.map((row) => (
                <li key={row.label}>
                  <span>
                    {row.label}
                    <br />
                    <span className="muted small">
                      Counted {row.count} {row.count === 1 ? 'time' : 'times'}. {row.lastDiscussedAt ? `Last came up ${dateText(row.lastDiscussedAt)}.` : 'Not saved as discussed.'}
                    </span>
                  </span>
                  <span className="row-actions">
                    <ToldButton topics={[row.label]} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <a className="btn btn-outline-thin" href="#/visits">
          {settings.labels.visits}
        </a>
        <p className="muted small">Counted from your own entries. Not reviewed by a doctor, and not a diagnosis.</p>
      </main>
    </div>
  );
}
