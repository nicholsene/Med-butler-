import { useState } from 'react';
import { useApp } from '../state/AppContext';

/** Marks one or more topics as told. Asks which doctor only when there's a choice to make. */
export function ToldButton({ topics, doctorIds }: { topics: string[]; doctorIds?: string[] }) {
  const { doctors, addMark } = useApp();
  const [picking, setPicking] = useState(false);
  const [done, setDone] = useState(false);
  const save = (doctorId: string | null) => {
    for (const topic of topics) addMark(topic, doctorId);
    setPicking(false);
    setDone(true);
  };

  if (done) {
    return (
      <span className="small muted" role="status">
        Marked as told
      </span>
    );
  }
  if (!picking) {
    return (
      <button type="button" className="link-btn" onClick={() => (doctors.length ? setPicking(true) : save(null))}>
        Told my doctor
      </button>
    );
  }
  const first = doctorIds?.length ? doctors.filter((d) => doctorIds.includes(d.id)) : doctors;
  const rest = doctors.filter((d) => !first.includes(d));
  return (
    <div className="told-picker" role="group" aria-label="Which doctor did you tell?">
      <span className="small">Which doctor?</span>
      {[...first, ...rest].map((d) => (
        <button key={d.id} type="button" className="chip" onClick={() => save(d.id)}>
          {d.role}
        </button>
      ))}
      <button type="button" className="chip" onClick={() => save(null)}>
        Not listed or not sure
      </button>
      <button type="button" className="link-btn" onClick={() => setPicking(false)}>
        Cancel
      </button>
    </div>
  );
}
