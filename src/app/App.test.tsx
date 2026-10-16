import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useTelemetryStore } from '@/store';
import { makeNode } from '@/test/factories';

import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    useTelemetryStore.setState(useTelemetryStore.getInitialState(), true);
  });

  it('shows the dashboard shell and an offline connection before any data arrives', () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'A clear view of your fleet.',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Connection: offline · 0 active');
  });

  it('reflects live telemetry from the store', () => {
    render(<App />);

    act(() => {
      const { actions } = useTelemetryStore.getState();
      actions.setConnection('live');
      actions.applySnapshot(
        [makeNode({ nodeId: 'node-0001' }), makeNode({ nodeId: 'node-0002', status: 'CRITICAL' })],
        1,
      );
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      'Connection: live · 2 active · 1 critical',
    );
  });
});
