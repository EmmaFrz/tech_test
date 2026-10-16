import type { ReactElement } from 'react';

import { App } from './App';
import { TelemetryProvider } from './TelemetryProvider';

/** The whole interactive dashboard: the single client-side tree the page mounts. */
export function Dashboard(): ReactElement {
  return (
    <TelemetryProvider>
      <App />
    </TelemetryProvider>
  );
}
