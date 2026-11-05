import { useState } from 'react';
import { BackLink, BottomNav, Heading, Scene } from '../components/ui';
import { CARDS, getCard } from '../logic/cards';
import { kitRows, kitSummary, LOCATIONS, missingItems, parsePrepId, type KitRow, type Location } from '../logic/prep';
import { useApp } from '../state/AppContext';

const STATUS_CLASS = { Ready: 'status-ready', Fix: 'status-fix', Check: 'status-check' };

function ShoppingList() {
  const { shopping, addToShopping, toggleShopping, removeShopping, setHave, prep } = useApp();
  const [text, setText] = useState('');
  const add = () => {
    if (text.trim()) addToShopping([{ name: text.trim(), prepId: null }]);
    setText('');
  };
  return (
    <section className="panel panel-white" id="shopping">
      <h2>Shopping list</h2>
      {shopping.length === 0 && <p className="muted">Nothing on your list.</p>}
      <ul className="check-rows">
        {shopping.map((s) => (
          <li key={s.id}>
            <label>
              <input
                type="checkbox"
                checked={s.done}
                onChange={() => {
                  toggleShopping(s.id);
                  // Buying something ticks it in the kit it came from.
                  const row = s.prepId ? parsePrepId(s.prepId) : null;
                  if (row && !s.done) setHave({ ...row, custom: prep.find((p) => p.id === s.prepId)?.custom ?? false }, true);
                }}
              />
              <span className={s.done ? 'done' : ''}>{s.name}</span>
            </label>
            <button type="button" className="link-btn" aria-label={`Remove ${s.name}`} onClick={() => removeShopping(s.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <label className="field">
        Add to list
        <span className="row">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
          />
          <button type="button" className="btn btn-small" onClick={add}>
            Add
          </button>
        </span>
      </label>
    </section>
  );
}

export function Prep() {
  const { settings, prep, addToShopping } = useApp();
  const missing = missingItems(CARDS, prep);
  const names = [...new Set(missing.map((m) => m.item))];
  const kits = CARDS.filter((c) => c.prepItems.length > 0 || prep.some((p) => p.cardId === c.id));
  return (
    <div className="page">
      <Scene voice={settings.voice} />
      <main className="stack pad grow">
        <Heading>Ready before it hits</Heading>
        {missing.length > 0 ? (
          <section className="panel panel-amber">
            <h2>
              {missing.length} {missing.length === 1 ? 'thing' : 'things'} to fix
            </h2>
            <p>{names.slice(0, 3).join(', ')}{names.length > 3 ? ', and more' : ''}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => addToShopping(missing.map((m) => ({ name: m.item, prepId: m.id })))}
            >
              Add missing items to list
            </button>
          </section>
        ) : (
          <p>Open a kit and tick what you already have in each place.</p>
        )}
        {kits.map((card) => {
          const summary = kitSummary(card, prep);
          return (
            <a key={card.id} className="kit-link" href={`#/prep/${encodeURIComponent(card.id)}`}>
              <span>
                <strong>{card.title}</strong>
                <span className="muted small block">{summary.text}</span>
              </span>
              <span className={STATUS_CLASS[summary.status]}>{summary.status}</span>
            </a>
          );
        })}
        {kits.length === 0 && <p className="muted">No kits yet.</p>}
        <section className="panel panel-white">
          <h2>Heading out?</h2>
          <a className="btn btn-outline-thin" href="#/prep/bag">
            Bag check
          </a>
        </section>
        <ShoppingList />
        <p className="muted small">Stored only on this phone.</p>
      </main>
      <BottomNav />
    </div>
  );
}

function Row({ row }: { row: KitRow }) {
  const { setHave, removeCustomItem } = useApp();
  return (
    <li>
      <label>
        <input type="checkbox" checked={row.have} onChange={(e) => setHave(row, e.target.checked)} />
        <span>{row.item}</span>
      </label>
      {row.custom && (
        <button type="button" className="link-btn" aria-label={`Remove ${row.item}`} onClick={() => removeCustomItem(row.id)}>
          Remove
        </button>
      )}
    </li>
  );
}

export function Kit({ cardId }: { cardId: string }) {
  const { settings, prep, addCustomItem, addToShopping, setHave } = useApp();
  const [location, setLocation] = useState<Location>('Bedside');
  const [text, setText] = useState('');
  const [added, setAdded] = useState(0);
  const card = getCard(cardId);

  if (!card) {
    return (
      <div className="page">
        <main className="stack pad grow">
          <BackLink to="/prep" />
          <Heading>This kit isn't available</Heading>
          <p>It may have been replaced in an update. Your other kits are still there.</p>
        </main>
      </div>
    );
  }

  const rows = kitRows(card, location, prep);
  const missing = rows.filter((r) => !r.have);
  const add = () => {
    if (text.trim()) addCustomItem(card.id, location, text.trim());
    setText('');
  };

  return (
    <div className="page">
      <Scene voice={settings.voice} strip />
      <main className="stack pad grow">
        <BackLink to="/prep" />
        <Heading>{card.title} kit</Heading>
        <div className="tabs" role="group" aria-label="Location">
          {LOCATIONS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={location === l}
              onClick={() => {
                setLocation(l);
                setAdded(0);
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <section className="panel panel-white">
          <ul className="check-rows">
            {rows.map((row) => (
              <Row key={row.id} row={row} />
            ))}
          </ul>
          <label className="field">
            Add an item here
            <span className="row">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add();
                  }
                }}
              />
              <button type="button" className="btn btn-small" onClick={add}>
                Add
              </button>
            </span>
          </label>
        </section>
        <button
          type="button"
          className="btn btn-primary"
          disabled={missing.length === 0}
          onClick={() => {
            addToShopping(missing.map((m) => ({ name: m.item, prepId: m.id })));
            // Saying what's missing counts as having checked this location.
            for (const m of missing) setHave(m, false);
            setAdded(missing.length);
          }}
        >
          {missing.length === 0 ? 'Nothing missing here' : `Add ${missing.length} missing to list`}
        </button>
        {added > 0 && (
          <p className="muted small" role="status">
            Added to your shopping list.
          </p>
        )}
        {card.status !== 'doctor_reviewed' && <p className="muted small">Not yet reviewed by your doctor.</p>}
      </main>
    </div>
  );
}

export function BagCheck() {
  const { prep, settings } = useApp();
  const kits = CARDS.filter((c) => c.prepItems.length > 0);
  return (
    <div className="page">
      <Scene voice={settings.voice} strip />
      <main className="stack pad grow">
        <BackLink to="/prep" />
        <Heading>Bag check</Heading>
        {kits.map((card) => (
          <section key={card.id} className="panel panel-white">
            <h2>{card.title}</h2>
            <ul className="check-rows">
              {kitRows(card, 'Bag', prep).map((row) => (
                <Row key={row.id} row={row} />
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
