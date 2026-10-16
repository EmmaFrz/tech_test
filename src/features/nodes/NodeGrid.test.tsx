import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useTelemetryStore, useUiStore } from '@/store';
import { makeNode, makeNodes } from '@/test/factories';
import { mockElementLayout } from '@/test/layout';
import { resetStores, seedFleet, startVisibleNodes } from '@/test/stores';

import { NodeGrid } from './NodeGrid';

describe('NodeGrid', () => {
  let stopSync: () => void;

  beforeEach(() => {
    mockElementLayout({ viewportHeight: 440, rowHeight: 44 });
    resetStores();
    stopSync = startVisibleNodes();
  });

  afterEach(() => {
    stopSync();
  });

  it('asks the user to wait while no telemetry has arrived', () => {
    render(<NodeGrid />);

    expect(screen.getByRole('status')).toHaveTextContent('Waiting for telemetry');
  });

  it('virtualizes the list: far fewer rows are mounted than there are nodes', () => {
    seedFleet(makeNodes(500));

    render(<NodeGrid />);

    const rows = screen.getAllByTestId('node-row');
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.length).toBeLessThan(40);
    expect(screen.getByRole('grid', { name: 'Fleet nodes' })).toHaveAttribute(
      'aria-rowcount',
      '501',
    );
  });

  it('shows every telemetry field of a node in its row', () => {
    seedFleet([
      makeNode({
        nodeId: 'node-0042',
        status: 'CRITICAL',
        cpuLoad: 94.2,
        memoryUsage: 71.5,
        latencyMs: 912,
        timestamp: Date.UTC(2026, 0, 1, 10, 20, 30),
      }),
    ]);

    render(<NodeGrid />);

    const row = screen.getByTestId('node-row');
    expect(row).toHaveAttribute('data-status', 'CRITICAL');
    expect(within(row).getByRole('button', { name: 'node-0042' })).toBeInTheDocument();
    expect(within(row).getByText('CRITICAL')).toBeVisible();
    expect(within(row).getByText('94.2%')).toBeVisible();
    expect(within(row).getByText('71.5%')).toBeVisible();
    expect(within(row).getByText('912 ms')).toBeVisible();
    expect(within(row).getByText('10:20:30')).toBeVisible();
  });

  it('selects a node when its row is clicked', () => {
    seedFleet(makeNodes(3));
    render(<NodeGrid />);

    fireEvent.click(screen.getByRole('button', { name: 'node-0002' }));

    expect(useUiStore.getState().selectedNodeId).toBe('node-0002');
    expect(screen.getAllByRole('row', { selected: true })).toHaveLength(1);
  });

  it('selects the focused node with Enter, which activates its button', () => {
    seedFleet(makeNodes(3));
    render(<NodeGrid />);

    const button = screen.getByRole('button', { name: 'node-0003' });
    button.focus();
    fireEvent.click(button);

    expect(useUiStore.getState().selectedNodeId).toBe('node-0003');
  });

  it('keeps a single row in the tab order', () => {
    seedFleet(makeNodes(5));
    render(<NodeGrid />);

    const tabbable = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('tabindex') === '0');

    expect(tabbable).toHaveLength(1);
  });

  it('moves focus between rows with the arrow keys', () => {
    seedFleet(makeNodes(5));
    render(<NodeGrid />);
    const first = screen.getByRole('button', { name: 'node-0001' });
    first.focus();

    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: 'node-0002' })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('button', { name: 'node-0002' }), { key: 'End' });
    expect(screen.getByRole('button', { name: 'node-0005' })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('button', { name: 'node-0005' }), { key: 'ArrowUp' });
    expect(screen.getByRole('button', { name: 'node-0004' })).toHaveFocus();
  });

  it('shows a no-matches message when the filter excludes every node', () => {
    seedFleet(makeNodes(3));
    render(<NodeGrid />);

    act(() => useUiStore.getState().actions.setStatusFilter('CRITICAL'));

    expect(screen.getByRole('status')).toHaveTextContent('No nodes match');
    expect(screen.queryByTestId('node-row')).not.toBeInTheDocument();
  });

  it('marks nodes that stopped reporting as stale', () => {
    seedFleet([
      makeNode({ nodeId: 'node-0001', timestamp: 1_000_000 }),
      makeNode({ nodeId: 'node-0002', timestamp: 1_000_000 - 20_000 }),
    ]);
    render(<NodeGrid />);

    const staleRows = screen
      .getAllByTestId('node-row')
      .filter((row) => row.dataset['stale'] === 'true');

    expect(staleRows).toHaveLength(1);
    expect(staleRows[0]).toHaveAttribute('data-node-id', 'node-0002');
    expect(screen.getAllByText('STALE')).toHaveLength(1);
  });

  it('updates a row live without remounting it', () => {
    seedFleet(makeNodes(2));
    render(<NodeGrid />);
    const row = screen.getAllByTestId('node-row')[0];

    act(() =>
      useTelemetryStore.getState().actions.applyBatch({
        updates: [makeNode({ nodeId: 'node-0001', latencyMs: 777, timestamp: 2_000_000_000_000 })],
        serverTime: null,
        receivedAt: 2,
      }),
    );

    expect(within(screen.getByTestId('node-grid')).getByText('777 ms')).toBeVisible();
    expect(row).toBeInTheDocument();
  });
});
