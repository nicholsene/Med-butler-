import { useState } from 'react';
import { BackLink, BottomNav, Heading } from '../components/ui';
import { CARDS } from '../logic/cards';
import { groupCards, searchCards } from '../logic/guides';

/** Every guide, grouped in plain words, so any of them can be reached without a reading. */
export function Guides({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const found = searchCards(CARDS, query);
  const groups = groupCards(found);
  return (
    <div className="page">
      <main className="stack pad grow">
        <BackLink to="/" />
        <Heading>Find a guide</Heading>
        <p className="lead">Pick what fits best. Guides are not a diagnosis.</p>
        <label className="field">
          Search by title or symptom
          <input type="search" value={query} autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
        </label>
        <p className="muted small" role="status">
          {found.length} of {CARDS.length} {CARDS.length === 1 ? 'guide' : 'guides'}
        </p>
        {groups.length === 0 && <p>No guide matches that. Try one word, or clear the search.</p>}
        {groups.map((g) => (
          <section key={g.id} className="stack-small" aria-labelledby={`group-${g.id}`}>
            <h2 id={`group-${g.id}`}>{g.name}</h2>
            <ul className="plain-list guide-list">
              {g.cards.map((c) => (
                <li key={c.id}>
                  <a className="guide-link" href={`#/guide/${encodeURIComponent(c.id)}`}>
                    {c.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <a className="btn btn-outline" href="#/serious">
          Go to the emergency check
        </a>
      </main>
      <BottomNav />
    </div>
  );
}
