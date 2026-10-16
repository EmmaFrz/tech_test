import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTelemetryStore } from '@/store';
import { makeNodes } from '@/test/factories';
import { resetStores } from '@/test/stores';

import { ConnectionBanner } from './ConnectionBanner';

function receive(receivedAt: number): void {
  act(() => {
    const { actions } = useTelemetryStore.getState();
    actions.setConnection('live');
    actions.applySnapshot(makeNodes(1), receivedAt);
  });
}

describe('ConnectionBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    resetStores();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays hidden while data flows normally', () => {
    receive(99_900);

    render(<ConnectionBanner />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns once the stream has been quiet for more than three seconds', () => {
    receive(100_000);
    render(<ConnectionBanner />);

    act(() => {
      vi.advanceTimersByTime(3_500);
    });

    expect(screen.getByRole('alert')).toHaveTextContent('No telemetry received for 3.5s');
  });

  it.each(['reconnecting', 'offline'] as const)('warns while the connection is %s', (state) => {
    render(<ConnectionBanner />);

    act(() => useTelemetryStore.getState().actions.setConnection(state));

    expect(screen.getByRole('alert')).toHaveTextContent('Connection lost');
  });
});
