import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useTelemetryStore } from '@/store';
import { makeNode, TEST_TIMESTAMP } from '@/test/factories';
import { resetStores, seedFleet } from '@/test/stores';

import { MetricsOverview } from './MetricsOverview';

describe('MetricsOverview', () => {
  beforeEach(resetStores);

  it('shows neutral cards and a dash before any data arrives', () => {
    render(<MetricsOverview />);

    expect(screen.getByRole('group', { name: 'Active nodes' })).toHaveTextContent('0 / 0');
    expect(screen.getByRole('group', { name: 'Critical alerts' })).toHaveAttribute(
      'data-tone',
      'neutral',
    );
    expect(screen.getByRole('group', { name: 'Average latency' })).toHaveTextContent('—');
  });

  it('reflects the nodes in the store', () => {
    seedFleet([
      makeNode({ nodeId: 'a', status: 'OK', latencyMs: 100 }),
      makeNode({ nodeId: 'b', status: 'WARNING', latencyMs: 300 }),
      makeNode({ nodeId: 'c', status: 'CRITICAL', latencyMs: 800 }),
      makeNode({ nodeId: 'd', status: 'CRITICAL', latencyMs: 400 }),
    ]);

    render(<MetricsOverview />);

    expect(screen.getByRole('group', { name: 'Active nodes' })).toHaveTextContent('4 / 4');
    expect(screen.getByRole('group', { name: 'Critical alerts' })).toHaveTextContent('2');
    expect(screen.getByRole('group', { name: 'Warnings' })).toHaveTextContent('1');
    expect(screen.getByRole('group', { name: 'Average latency' })).toHaveTextContent('400 ms');
  });

  it('switches the critical card to its alert state while any node is critical', () => {
    seedFleet([makeNode({ status: 'OK' })]);
    render(<MetricsOverview />);
    expect(screen.getByRole('group', { name: 'Critical alerts' })).toHaveAttribute(
      'data-tone',
      'neutral',
    );

    seedFleet([makeNode({ status: 'CRITICAL' })]);

    expect(screen.getByRole('group', { name: 'Critical alerts' })).toHaveAttribute(
      'data-tone',
      'alert',
    );
    expect(screen.getByRole('group', { name: 'Critical alerts' })).toHaveTextContent('Alert');
  });

  it('excludes silent nodes from the active count and the other figures', () => {
    seedFleet([
      makeNode({ nodeId: 'fresh', status: 'OK', latencyMs: 100, timestamp: TEST_TIMESTAMP }),
      makeNode({
        nodeId: 'silent',
        status: 'CRITICAL',
        latencyMs: 900,
        timestamp: TEST_TIMESTAMP - 30_000,
      }),
    ]);

    render(<MetricsOverview />);

    expect(screen.getByRole('group', { name: 'Active nodes' })).toHaveTextContent('1 / 2');
    expect(screen.getByRole('group', { name: 'Active nodes' })).toHaveTextContent('1 stale');
    expect(screen.getByRole('group', { name: 'Critical alerts' })).toHaveAttribute(
      'data-tone',
      'neutral',
    );
    expect(screen.getByRole('group', { name: 'Average latency' })).toHaveTextContent('100 ms');
  });

  it('keeps up with live updates', () => {
    seedFleet([makeNode({ nodeId: 'a', status: 'OK', latencyMs: 100 })]);
    render(<MetricsOverview />);

    act(() =>
      useTelemetryStore.getState().actions.applyBatch({
        updates: [
          makeNode({
            nodeId: 'a',
            status: 'CRITICAL',
            latencyMs: 500,
            timestamp: TEST_TIMESTAMP + 1,
          }),
        ],
        serverTime: null,
        receivedAt: 2,
      }),
    );

    expect(screen.getByRole('group', { name: 'Critical alerts' })).toHaveTextContent('1');
    expect(screen.getByRole('group', { name: 'Average latency' })).toHaveTextContent('500 ms');
  });
});
