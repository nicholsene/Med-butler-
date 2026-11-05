import { useMemo, useState } from 'react';
import { BackLink, Heading } from '../components/ui';
import { buildDeepReview, describeDeepReview } from '../logic/deepReview';
import { dayStamp, deliverFile, jsonFile, type DeliverResult } from '../logic/share';
import { useApp } from '../state/AppContext';

const RESULT_TEXT: Record<DeliverResult, string> = {
  shared: 'Shared with the app you picked. Nothing else was sent.',
  downloaded: 'Saved to your downloads. Nothing was sent.',
  cancelled: 'Cancelled. Nothing was saved or sent.',
  failed: "That didn't work. Nothing was sent. Please try again.",
};

export function DeepReview() {
  const { settings, logs, readings, ratings, questions, prep, shopping, timers, doctors, visits, marks } = useApp();
  const [includeNotes, setIncludeNotes] = useState(false);
  const [result, setResult] = useState<DeliverResult | null>(null);
  const now = useMemo(() => Date.now(), []);

  const review = useMemo(
    () => buildDeepReview({ settings, logs, readings, ratings, questions, prep, shopping, timers, doctors, visits, marks }, { includeNotes }, now),
    [settings, logs, readings, ratings, questions, prep, shopping, timers, doctors, visits, marks, includeNotes, now],
  );
  // The preview below and the saved file are this same text.
  const text = useMemo(() => JSON.stringify(review, null, 2), [review]);
  const contents = describeDeepReview(review);

  return (
    <div className="page">
      <main className="stack pad grow">
        <BackLink to="/settings" />
        <Heading>Deep review file</Heading>
        <p>
          This is optional. It makes a file for a closer look at your data, if you want one. <strong>Nothing is sent anywhere automatically.</strong> You see all of it here, then you choose whether to save or share it, and with whom.
        </p>

        <section className="panel panel-white stack-small">
          <h2>What's in it</h2>
          <ul className="count-list" data-testid="review-contents">
            {contents.map((c) => (
              <li key={c.label}>
                <span>{c.label}</span>
                <strong>{c.count}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel panel-white stack-small">
          <h2>What's removed</h2>
          <ul>
            {review.removed.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <label className="check-row">
            <input type="checkbox" checked={includeNotes} data-testid="review-notes" onChange={(e) => setIncludeNotes(e.target.checked)} />
            Include my visit notes
          </label>
          <p className="small muted">Notes are off by default because people write names in them. Names you saved and details that look like phone numbers or emails are removed, but software can't catch every name, so please read them below first.</p>
        </section>

        <section className="panel panel-white stack-small">
          <h2>The exact file</h2>
          <pre className="file-preview" tabIndex={0} data-testid="review-preview">
            {text}
          </pre>
        </section>

        <p className="panel panel-amber small">This file isn't encrypted. It still holds your health details and dates, so only share it with someone you trust, and delete it when you're done.</p>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="review-save"
          onClick={async () => setResult(await deliverFile(jsonFile(`butler-deep-review-${dayStamp(now)}.json`, text)))}
        >
          Save or share this file
        </button>
        {result && (
          <p className="muted small" role="status" data-testid="review-result">
            {RESULT_TEXT[result]}
          </p>
        )}
      </main>
    </div>
  );
}
