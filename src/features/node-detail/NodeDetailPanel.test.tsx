import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { historyStore, useTelemetryStore, useUiStore } from '@/store';
import { makeNode, TEST_TIMESTAMP } from '@/test/factories';
import { resetStores, seedFleet, startVisibleNodes } from '@/test/stores';

import { NodeDetailPanel } from './NodeDetailPanel';

const NODE_TIMESTAMP = Date.UTC(2026, 0, 1, 10, 20, 30);

function select(nodeId: string | null): void {
  act(() => useUiStore.getState().actions.selectNode(nodeId));
}

describe('NodeDetailPanel', () => {
  let stopSync: () => void;

  beforeEach(() => {
    resetStores();
    seedFleet([
      makeNode({
        nodeId: 'node-0042',
        status: 'CRITICAL',
        cpuLoad: 94,
        memoryUsage: 71,
        latencyMs: 912,
        timestamp: NODE_TIMESTAMP,
      }),
      makeNode({ nodeId: 'node-0001', status: 'OK' }),
    ]);
    stopSync = startVisibleNodes();
  });

  afterEach(() => {
    stopSync();
  });

  it('invites the user to select a node when nothing is selected', () => {
    render(<NodeDetailPanel />);

    expect(screen.getByRole('status')).toHaveTextContent('No node selected');
  });

  it('shows the current values of the selected node', () => {
    render(<NodeDetailPanel />);

    select('node-0042');

    const panel = screen.getByTestId('node-detail');
    expect(within(panel).getByRole('heading', { name: 'node-0042' })).toBeVisible();
    expect(within(panel).getByText('CRITICAL')).toBeVisible();
    expect(within(panel).getByText('94.0%', { selector: 'dd' })).toBeVisible();
    expect(within(panel).getByText('71.0%', { selector: 'dd' })).toBeVisible();
    expect(within(panel).getByText('912 ms', { selector: 'dd' })).toBeVisible();
    expect(within(panel).getByText('10:20:30')).toBeVisible();
  });

  it('follows live updates of the selected node', () => {
    render(<NodeDetailPanel />);
    select('node-0042');

    act(() =>
      useTelemetryStore.getState().actions.applyBatch({
        updates: [
          makeNode({
            nodeId: 'node-0042',
            status: 'OK',
            latencyMs: 55,
            timestamp: TEST_TIMESTAMP + 5_000,
          }),
        ],
        serverTime: null,
        receivedAt: 2,
      }),
    );

    const panel = screen.getByTestId('node-detail');
    expect(within(panel).getByText('55 ms', { selector: 'dd' })).toBeVisible();
    expect(within(panel).getByText('OK')).toBeVisible();
  });

  it('closes with the Close button', () => {
    render(<NodeDetailPanel />);
    select('node-0042');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(useUiStore.getState().selectedNodeId).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('No node selected');
  });

  it('closes with the Escape key', () => {
    render(<NodeDetailPanel />);
    select('node-0042');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(useUiStore.getState().selectedNodeId).toBeNull();
  });

  it('ignores other keys', () => {
    render(<NodeDetailPanel />);
    select('node-0042');

    fireEvent.keyDown(document, { key: 'Enter' });

    expect(useUiStore.getState().selectedNodeId).toBe('node-0042');
  });

  it('says the node is hidden when the current filter excludes it, and keeps it selected', () => {
    render(<NodeDetailPanel />);
    select('node-0042');
    expect(screen.queryByText(/Hidden by the current filter/)).not.toBeInTheDocument();

    act(() => useUiStore.getState().actions.setStatusFilter('OK'));

    expect(screen.getByText(/Hidden by the current filter/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'node-0042' })).toBeVisible();
  });

  it('flags a node that stopped reporting', () => {
    seedFleet([
      makeNode({ nodeId: 'node-0042', timestamp: 1_000_000 - 20_000 }),
      makeNode({ nodeId: 'node-0001', timestamp: 1_000_000 }),
    ]);
    render(<NodeDetailPanel />);

    select('node-0042');

    expect(screen.getByText('STALE')).toBeVisible();
  });

  it('explains when the selected node is unknown', () => {
    render(<NodeDetailPanel />);

    select('node-9999');

    expect(screen.getByRole('status')).toHaveTextContent('Node not reported');
  });

  it('collects samples first and then draws the charts from the node history', () => {
    render(<NodeDetailPanel />);
    select('node-0042');
    expect(screen.getAllByText('Collecting samples...')).toHaveLength(2);

    act(() =>
      historyStore.record([
        makeNode({ nodeId: 'node-0042', timestamp: NODE_TIMESTAMP + 1_000 }),
        makeNode({ nodeId: 'node-0042', timestamp: NODE_TIMESTAMP + 2_000 }),
      ]),
    );
    act(() =>
      historyStore.record([makeNode({ nodeId: 'node-0042', timestamp: NODE_TIMESTAMP + 3_000 })]),
    );

    const charts = screen.getAllByTestId('telemetry-chart');
    expect(charts).toHaveLength(2);
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });
});
