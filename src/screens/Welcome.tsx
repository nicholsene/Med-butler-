import { useState } from 'react';
import copy from '../data/copy.json';
import { DEFAULT_LABELS } from '../data/defaults';
import { Heading, ListEditor, Scene, go } from '../components/ui';
import { useApp } from '../state/AppContext';

export function Welcome() {
  return (
    <div className="page page-white">
      <Scene />
      <main className="stack pad">
        <Heading>This was made for you</Heading>
        <p className="note">{copy.personalNote}</p>
        <p>It helps you keep track of symptoms, see possible connections, and have a next step when something feels serious.</p>
        <section className="panel panel-amber">
          <h2>Know this first</h2>
          <p>Guidance comes from named medical sources, is not reviewed for you, and some sources are still being rechecked. It doesn't replace your doctors or 911.</p>
        </section>
        <section className="panel panel-green">
          <h2>Who can see what</h2>
          {copy.whoSees.map((row) => (
            <div className="who" key={row.who}>
              <strong>{row.who}:</strong> {row.what}
            </div>
          ))}
        </section>
        <a className="btn btn-primary btn-large" href="#/setup">
          Review my details
        </a>
        <p className="muted small">Add your conditions and medications next. You can change them at any time.</p>
        <a className="inline-link" href="#/backup">
          Restore from a backup instead
        </a>
      </main>
    </div>
  );
}

export function Setup() {
  const { settings, updateSettings } = useApp();
  const [name, setName] = useState(settings.name);
  const [conditions, setConditions] = useState(settings.conditions);
  const [medications, setMedications] = useState(settings.medications);
  const [phones, setPhones] = useState(settings.phones);
  const [names, setNames] = useState(() => {
    const given = (who: 'contactA' | 'contactB') => (settings.labels[who] === DEFAULT_LABELS[who] ? '' : settings.labels[who]);
    return { contactA: given('contactA'), contactB: given('contactB') };
  });

  return (
    <div className="page page-white">
      <main className="stack pad">
        <a className="back" href="#/">
          Back
        </a>
        <Heading>Confirm your details</Heading>
        <p>Everything here stays on this phone. Leave anything blank and add it later in {settings.labels.settings}.</p>
        <label className="field">
          What should we call you?
          <input value={name} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
        </label>
        <ListEditor label="Your conditions" items={conditions} onChange={setConditions} />
        <ListEditor label="Your medications" items={medications} onChange={setMedications} />
        {(['contactA', 'contactB'] as const).map((who, i) => (
          <div className="stack-small" key={who}>
            <h2>Person to call {i + 1}</h2>
            <label className="field">
              Their name
              <input autoComplete="off" value={names[who]} onChange={(e) => setNames({ ...names, [who]: e.target.value })} />
            </label>
            <label className="field">
              Their phone number
              <input type="tel" autoComplete="off" value={phones[who]} onChange={(e) => setPhones({ ...phones, [who]: e.target.value })} />
            </label>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-primary btn-large"
          onClick={() => {
            const labels = {
              ...settings.labels,
              contactA: names.contactA.trim() || DEFAULT_LABELS.contactA,
              contactB: names.contactB.trim() || DEFAULT_LABELS.contactB,
            };
            updateSettings({ name: name.trim(), conditions, medications, phones, labels, setupComplete: true });
            go('/');
          }}
        >
          These look right
        </button>
      </main>
    </div>
  );
}
