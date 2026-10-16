import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import { TelemetryProvider } from '@/app/TelemetryProvider';

import '@/ui/tokens.css';
import '@/app/global.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Root element is missing');
}

createRoot(rootElement).render(
  <StrictMode>
    <TelemetryProvider>
      <App />
    </TelemetryProvider>
  </StrictMode>,
);
