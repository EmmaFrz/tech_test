import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Dashboard } from '@/shell/Dashboard';

import '@/ui/tokens.css';
import '@/shell/global.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Root element is missing');
}

createRoot(rootElement).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>,
);
