import { useEffect } from 'react';

import type { ReactElement, ReactNode } from 'react';

import { startTelemetry } from './startTelemetry';

export interface TelemetryProviderProps {
  readonly children: ReactNode;
}

export function TelemetryProvider({ children }: TelemetryProviderProps): ReactElement {
  useEffect(() => startTelemetry(), []);

  return <>{children}</>;
}
