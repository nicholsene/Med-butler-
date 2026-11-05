import { BottomNav, Heading, Scene } from '../components/ui';
import { ASSOCIATION_NOTE, chipCounts, computePatterns, inWindow } from '../logic/patterns';
import { useApp } from '../state/AppContext';

export function MapScreen() {
  const { settings, logs, readings, questions } = useApp();
  const now = Date.now();
  const patterns = computePatterns(logs, readings, settings.thresholds, now);
  const counts = chipCounts(inWindow(logs, now, 30));
  const asks = questions.filter((q) => !q.dismissed);

  return (
    <div className="page">
      <Scene voice={settings.voice} strip />
      <main className="stack pad grow">
        <p className="eyebrow">Connections</p>
        <Heading>What keeps showing up together</Heading>
        <p>Possibilities to check with your doctor, from the last 30 days. This is not a diagnosis.</p>

        {patterns.length === 0 && (
          <section className="panel panel-white">
            <h2>Nothing to connect yet</h2>
            <p>Patterns appear once something has been logged at least three times.</p>
          </section>
        )}
        {patterns.map((p) => (
          <section key={p.id} className="panel panel-pattern">
            <p className="tag">{p.label}</p>
            <p className="pattern-count">{p.headline}</p>
            <p>{p.detail}</p>
          </section>
        ))}
        {patterns.length > 0 && <p className="muted small">{ASSOCIATION_NOTE}</p>}

        {counts.length > 0 && (
          <section className="panel panel-white">
            <h2>Your log counts</h2>
            <ul className="count-list">
              {counts.map((c) => (
                <li key={c.chip}>
                  <span>{c.chip}</span>
                  <strong>{c.count}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}

        {settings.medications.length === 0 && (
          <section className="panel panel-amber">
            <h2>Your medications</h2>
            <p>Add your list so it's on your {settings.labels.brief}.</p>
            <a className="inline-link" href="#/settings/details">
              Add medications
            </a>
          </section>
        )}

        {asks.length > 0 && (
          <section className="panel panel-white">
            <h2>Ask your doctor</h2>
            <ul>
              {asks.slice(0, 3).map((q) => (
                <li key={q.id}>{q.text}</li>
              ))}
            </ul>
          </section>
        )}
        <a className="btn btn-primary" href="#/brief">
          Open {settings.labels.brief}
        </a>
      </main>
      <BottomNav />
    </div>
  );
}
