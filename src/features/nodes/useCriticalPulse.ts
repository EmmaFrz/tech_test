import { useEffect, useState } from 'react';

import type { NodeStatus } from '@shared/protocol';

export const PULSE_DURATION_MS = 2_000;

interface PulseState {
  readonly status: NodeStatus | undefined;
  readonly isPulsing: boolean;
}

/** True for two seconds after a node that was not critical becomes CRITICAL. */
export function useCriticalPulse(status: NodeStatus | undefined): boolean {
  const [state, setState] = useState<PulseState>({ status, isPulsing: false });

  if (state.status !== status) {
    const hasEnteredCritical =
      status === 'CRITICAL' && state.status !== undefined && state.status !== 'CRITICAL';
    setState({ status, isPulsing: hasEnteredCritical });
  }

  useEffect(() => {
    if (!state.isPulsing) {
      return undefined;
    }

    const timer = setTimeout(
      () => setState((current) => ({ ...current, isPulsing: false })),
      PULSE_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [state.isPulsing]);

  return state.isPulsing;
}
