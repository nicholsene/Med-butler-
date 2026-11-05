import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Bundled, not fetched, so the font works offline. System fonts are the fallback.
import '@fontsource/atkinson-hyperlegible-next/latin-400.css';
import '@fontsource/atkinson-hyperlegible-next/latin-600.css';
import '@fontsource/atkinson-hyperlegible-next/latin-700.css';
import './styles.css';
import { App } from './App';
import { AppProvider } from './state/AppContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
