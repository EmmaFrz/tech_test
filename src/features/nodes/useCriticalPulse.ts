import { useEffect, useState } from 'react';

import { CRITICAL_PULSE_MS } from '@/domain/criticalEntries';

interface PulseState {
  readonly criticalSince: number | undefined;
  readonly isPulsing: boolean;
}

/**
 * True for two seconds once the row shows a recent entry into CRITICAL. The entry lives in the
 * store, outside the row, so a row that mounts while it is recent (a filter or a scroll just
 * revealed the node) pulses too.
 */
export function useCriticalPulse(criticalSince: number | undefined): boolean {
  const [state, setState] = useState<PulseState>({
    criticalSince,
    isPulsing: criticalSince !== undefined,
  });

  if (state.criticalSince !== criticalSince) {
    setState({ criticalSince, isPulsing: criticalSince !== undefined });
  }

  useEffect(() => {
    if (!state.isPulsing) {
      return undefined;
    }

    const timer = setTimeout(
      () => setState((current) => ({ ...current, isPulsing: false })),
      CRITICAL_PULSE_MS,
    );
    return () => clearTimeout(timer);
  }, [state]);

  return state.isPulsing;
}
