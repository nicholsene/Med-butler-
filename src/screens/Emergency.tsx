import { useEffect } from 'react';
import emergency from '../data/emergency.json';
import { BackLink, CallButtons, Heading, NO_ALERTS, TextButtons } from '../components/ui';
import { useApp } from '../state/AppContext';

export function Serious() {
  const { settings, setSession } = useApp();
  useEffect(() => {
    // Starting the check again means the next reading is a first reading.
    setSession({ awaitingRecheck: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="page page-white">
      <main className="stack pad grow">
        <BackLink to="/" />
        <Heading>Do you have any of these right now?</Heading>
        <ul className="check-list">
          {emergency.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <a className="btn btn-red btn-xl" href="#/call911">
          Yes, call 911
        </a>
        <a className="btn btn-outline btn-large" href={settings.setupComplete ? '#/readings' : '#/'}>
          None of these
        </a>
        <p className="muted small push-down">{NO_ALERTS}</p>
        <p className="muted small">{emergency.note}</p>
      </main>
    </div>
  );
}

export function Call911() {
  return (
    <div className="page page-white">
      <main className="stack pad grow">
        <BackLink to="/serious" />
        <Heading>Call 911 now</Heading>
        <p>Tap the button to start the call. Tell them what's happening and where you are.</p>
        {/* Only a tap dials. Nothing on this screen starts a call by itself. */}
        <a className="btn btn-red btn-call" href="tel:911">
          Call 911
        </a>
        <h2>Then let someone know</h2>
        <p className="muted" data-testid="no-alerts">{NO_ALERTS}</p>
        <CallButtons />
        <TextButtons />
      </main>
    </div>
  );
}
