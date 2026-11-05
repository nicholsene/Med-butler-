import { BackupReminder, BottomNav, CallButtons, Heading, HomeScreenWarning, Scene, VoiceSwitch } from '../components/ui';
import { CARDS } from '../logic/cards';
import { missingItems, restockHeadline } from '../logic/prep';
import { useApp } from '../state/AppContext';

export function Home() {
  const { settings, prep } = useApp();
  const { labels } = settings;
  const restock = restockHeadline(missingItems(CARDS, prep));
  return (
    <div className="page">
      <Scene voice={settings.voice} />
      <main className="stack pad grow">
        <div className="row-between">
          <p className="muted greeting">{settings.name ? `Hi, ${settings.name}` : 'Hi'}</p>
          <VoiceSwitch />
        </div>
        <Heading>What do you need right now?</Heading>
        <a className="action action-red" href="#/serious">
          <span className="action-title">{labels.serious}</span>
          <span>Check for emergencies, then get help</span>
        </a>
        <a className="action action-green" href="#/log">
          <span className="action-title">{labels.logThis}</span>
          <span>Save a symptom in about ten seconds</span>
        </a>
        <a className="tile tile-link" href="#/guides">
          <strong>Find a guide</strong>
          <span>Browse every guide by group, or search</span>
        </a>
        {restock && (
          <a className="tile tile-amber" href="#/prep">
            <strong>{restock.title}</strong>
            <span>{restock.detail}</span>
          </a>
        )}
        <div className="grid-2">
          <a className="tile tile-link" href="#/brief">
            {labels.brief}
          </a>
          <a className="tile tile-link" href="#/gaps">
            {labels.gaps}
          </a>
          <a className="tile tile-link" href="#/visits">
            {labels.visits}
          </a>
          <a className="tile tile-link" href="#/settings">
            {labels.settings}
          </a>
        </div>
        {/* Call buttons stay above the notices, so a notice never pushes them down the screen. */}
        <div className="push-down stack">
          <CallButtons />
          <BackupReminder />
          <HomeScreenWarning />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
