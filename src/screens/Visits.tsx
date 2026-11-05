import { useState } from 'react';
import { BackLink, Heading, Toggle, dateText } from '../components/ui';
import { logChips } from '../logic/cards';
import { READING_TOPICS, visitTime } from '../logic/gaps';
import { useApp } from '../state/AppContext';

const todayValue = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function VisitForm() {
  const { settings, doctors, logs, addVisit, addDoctor } = useApp();
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(todayValue);
  const [topics, setTopics] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const [notes, setNotes] = useState('');
  const [withMeds, setWithMeds] = useState(false);
  const [meds, setMeds] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [newRole, setNewRole] = useState('');

  const loggedChips = logs.flatMap((l) => l.chips);
  const choices = [...new Set([...logChips(settings.customChips), ...loggedChips, ...READING_TOPICS, ...topics])];
  const toggle = (t: string) => setTopics(topics.includes(t) ? topics.filter((x) => x !== t) : [...topics, t]);
  const addOther = () => {
    const value = other.trim();
    if (value && !topics.includes(value)) setTopics([...topics, value]);
    setOther('');
  };
  const addRole = () => {
    const role = newRole.trim();
    if (!role) return;
    const existing = doctors.find((d) => d.role.toLowerCase() === role.toLowerCase());
    setDoctorId((existing ?? addDoctor(role)).id);
    setNewRole('');
  };

  const save = () => {
    const at = visitTime(date, Date.now());
    if (!doctorId) return setError('Pick who the visit was with, or add them below.');
    if (at === null) return setError("That date doesn't look right. Visits can't be in the future.");
    addVisit({
      doctorId,
      at,
      symptomsDiscussed: topics,
      notes: notes.trim(),
      medications: withMeds ? meds.split('\n').map((m) => m.trim()).filter(Boolean) : null,
    });
    setTopics([]);
    setNotes('');
    setMeds('');
    setWithMeds(false);
    setDate(todayValue());
    setError('');
    setSaved(true);
  };

  return (
    <section className="panel panel-white stack-small">
      <h2>Add a visit</h2>
      <div className="stack-small" role="group" aria-label="Who was the visit with?">
        <span className="field">Who was it with?</span>
        {doctors.length > 0 && (
          <div className="grid-2">
            {doctors.map((d) => (
              <Toggle key={d.id} pressed={doctorId === d.id} onClick={() => setDoctorId(d.id)}>
                {d.role}
              </Toggle>
            ))}
          </div>
        )}
        <label className="field">
          Add a doctor by role (for example, primary care)
          <span className="row">
            <input
              value={newRole}
              autoComplete="off"
              onChange={(e) => setNewRole(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addRole();
                }
              }}
            />
            <button type="button" className="btn btn-small" onClick={addRole}>
              Add
            </button>
          </span>
        </label>
      </div>
      <label className="field">
        Date
        <input type="date" value={date} max={todayValue()} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="stack-small">
        <span className="field">What came up?</span>
        <div className="grid-2">
          {choices.map((t) => (
            <Toggle key={t} pressed={topics.includes(t)} onClick={() => toggle(t)}>
              {t}
            </Toggle>
          ))}
        </div>
        <label className="field">
          Something else?
          <span className="row">
            <input
              value={other}
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addOther();
                }
              }}
            />
            <button type="button" className="btn btn-small" onClick={addOther}>
              Add
            </button>
          </span>
        </label>
      </div>
      <label className="field">
        Notes (optional)
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <label className="check-row">
        <input type="checkbox" checked={withMeds} onChange={(e) => setWithMeds(e.target.checked)} />
        Add the medication list from this visit (optional)
      </label>
      {withMeds && (
        <>
          <label className="field">
            One medication per line
            <textarea rows={4} value={meds} onChange={(e) => setMeds(e.target.value)} />
          </label>
          {settings.medications.length > 0 && (
            <button type="button" className="btn btn-outline-thin" onClick={() => setMeds(settings.medications.join('\n'))}>
              Start from my list
            </button>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="muted small" role="status">
          Visit saved.
        </p>
      )}
      <button type="button" className="btn btn-primary" onClick={save}>
        Save visit
      </button>
    </section>
  );
}

export function Visits() {
  const { settings, doctors, visits, marks, removeVisit, removeDoctor, removeMark } = useApp();
  const role = (id: string | null) => doctors.find((d) => d.id === id)?.role;
  const sortedVisits = [...visits].sort((a, b) => b.at - a.at);
  // Marks on a symptom read plainly. Gap review items have a key as a topic, so they are shown generically.
  const markText = (topic: string) => {
    if (topic.startsWith('pattern:')) return 'A pattern';
    if (topic.startsWith('rating:')) return 'A step rating';
    if (topic.startsWith('medication:')) return 'A medication list difference';
    return topic;
  };

  return (
    <div className="page">
      <main className="stack pad grow">
        <BackLink to="/gaps" label={`Back to ${settings.labels.gaps}`} />
        <Heading>{settings.labels.visits}</Heading>
        <p className="small">Saved only on this phone. Doctors are listed by role, with no name or number.</p>
        <VisitForm />

        <section className="panel panel-white">
          <h2>Visits</h2>
          {sortedVisits.length === 0 && <p className="muted">No visits saved yet.</p>}
          <ul className="plain-list">
            {sortedVisits.map((v) => (
              <li key={v.id} data-testid="visit-row">
                <span>
                  <strong>{role(v.doctorId) ?? 'Doctor no longer listed'}</strong>, {dateText(v.at)}
                  <br />
                  <span className="small">{v.symptomsDiscussed.join(', ') || 'No symptoms noted'}</span>
                  {v.medications && (
                    <>
                      <br />
                      <span className="small muted">Medications: {v.medications.join(', ') || 'none listed'}</span>
                    </>
                  )}
                  {v.notes && (
                    <>
                      <br />
                      <span className="small muted">{v.notes}</span>
                    </>
                  )}
                </span>
                <button type="button" className="link-btn" aria-label={`Remove visit from ${dateText(v.at)}`} onClick={() => removeVisit(v.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>

        {marks.length > 0 && (
          <section className="panel panel-white">
            <h2>"Told my doctor" marks</h2>
            <ul className="plain-list">
              {[...marks]
                .sort((a, b) => b.at - a.at)
                .map((m) => (
                  <li key={m.id}>
                    <span>
                      {markText(m.topic)}
                      <br />
                      <span className="small muted">
                        {dateText(m.at)}
                        {role(m.doctorId) ? `, ${role(m.doctorId)}` : ''}
                      </span>
                    </span>
                    <button type="button" className="link-btn" aria-label={`Remove mark from ${dateText(m.at)}`} onClick={() => removeMark(m.id)}>
                      Remove
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {doctors.length > 0 && (
          <section className="panel panel-white">
            <h2>Doctors</h2>
            <ul className="plain-list">
              {doctors.map((d) => (
                <li key={d.id}>
                  <span>{d.role}</span>
                  {visits.some((v) => v.doctorId === d.id) ? (
                    <span className="small muted">Has visits</span>
                  ) : (
                    <button type="button" className="link-btn" aria-label={`Remove ${d.role}`} onClick={() => removeDoctor(d.id)}>
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
