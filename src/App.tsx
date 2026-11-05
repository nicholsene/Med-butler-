import { StatusBanner } from './components/ui';
import { useRoute } from './router';
import { useApp } from './state/AppContext';
import { Backup } from './screens/Backup';
import { DeepReview } from './screens/DeepReview';
import { Call911, Serious } from './screens/Emergency';
import { GapReview } from './screens/GapReview';
import { Guide, NoCard } from './screens/Guide';
import { Guides } from './screens/Guides';
import { Home } from './screens/Home';
import { MapScreen } from './screens/MapScreen';
import { BagCheck, Kit, Prep } from './screens/Prep';
import { QuickLog } from './screens/QuickLog';
import { Readings, Recheck } from './screens/Readings';
import { SettingsScreen } from './screens/Settings';
import { VisitBrief } from './screens/VisitBrief';
import { Visits } from './screens/Visits';
import { Setup, Welcome } from './screens/Welcome';

function Screen({ route }: { route: string }) {
  const { settings } = useApp();
  const [, first, second] = route.split('/');

  // The emergency path stays reachable before setup is finished.
  if (first === 'serious') return <Serious />;
  if (first === 'call911') return <Call911 />;
  if (first === 'setup') return <Setup />;
  // Restoring has to work on a new phone, before setup.
  if (first === 'backup') return <Backup />;
  if (!settings.setupComplete) return <Welcome />;

  switch (first) {
    case 'readings':
      return <Readings />;
    case 'recheck':
      return <Recheck />;
    case 'guide':
      return <Guide key={second} cardId={decodeURIComponent(second ?? '')} />;
    case 'guides':
      return <Guides key={second} initialQuery={decodeURIComponent(second ?? '')} />;
    case 'no-card':
      return <NoCard />;
    case 'log':
      return <QuickLog />;
    case 'map':
      return <MapScreen />;
    case 'prep':
      if (second === 'bag') return <BagCheck />;
      return second ? <Kit key={second} cardId={decodeURIComponent(second)} /> : <Prep />;
    case 'brief':
      return <VisitBrief />;
    case 'gaps':
      return <GapReview />;
    case 'visits':
      return <Visits />;
    case 'deep-review':
      return <DeepReview />;
    case 'settings':
      return <SettingsScreen focus={second} />;
    default:
      return <Home />;
  }
}

export function App() {
  const route = useRoute();
  return (
    <div className="app">
      <StatusBanner />
      <Screen route={route} />
    </div>
  );
}
