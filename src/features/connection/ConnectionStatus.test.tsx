import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTelemetryStore } from '@/store';
import { makeNodes } from '@/test/factories';
import { resetStores } from '@/test/stores';

import { ConnectionStatus } from './ConnectionStatus';

describe('ConnectionStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    resetStores();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports the connection state and that no data has arrived yet', () => {
    render(<ConnectionStatus />);

    expect(screen.getByTestId('connection-status')).toHaveAttribute('data-state', 'connecting');
    expect(screen.getByRole('status')).toHaveTextContent('Connecting');
    expect(screen.getByText('waiting for data')).toBeVisible();
  });

  it('shows how long ago the latest update arrived and keeps counting', () => {
    act(() => useTelemetryStore.getState().actions.applySnapshot(makeNodes(1), 99_800));
    render(<ConnectionStatus />);
    expect(screen.getByText('updated 0.2s ago')).toBeVisible();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText('updated 1.2s ago')).toBeVisible();
  });

  it.each([
    ['connecting', 'Connecting'],
    ['live', 'Live'],
    ['reconnecting', 'Reconnecting'],
    ['offline', 'Offline'],
  ] as const)('labels the %s state as %s', (state, label) => {
    render(<ConnectionStatus />);

    act(() => useTelemetryStore.getState().actions.setConnection(state));

    expect(screen.getByRole('status')).toHaveTextContent(label);
    expect(screen.getByTestId('connection-status')).toHaveAttribute('data-state', state);
  });
});
