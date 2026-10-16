import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '@/store';
import { makeNode } from '@/test/factories';
import { mockElementLayout } from '@/test/layout';
import { resetStores, seedFleet, startVisibleNodes } from '@/test/stores';

import { App } from './App';

describe('App', () => {
  let stopSync: () => void;

  beforeEach(() => {
    mockElementLayout({ viewportHeight: 440, rowHeight: 44 });
    resetStores();
    stopSync = startVisibleNodes();
  });

  afterEach(() => {
    stopSync();
  });

  it('shows the shell regions before any data arrives', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Fleet Ops' })).toBeVisible();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByTestId('connection-status')).toHaveAttribute('data-state', 'connecting');
    expect(screen.getByRole('region', { name: 'Fleet overview' })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Node filters' })).toBeInTheDocument();
    expect(screen.getByTestId('node-grid')).toHaveTextContent('Waiting for telemetry');
    expect(screen.getByTestId('node-detail')).toHaveTextContent('No node selected');
  });

  it('walks through the critical triage journey', () => {
    seedFleet([
      makeNode({ nodeId: 'node-0001', status: 'OK' }),
      makeNode({ nodeId: 'node-0002', status: 'CRITICAL', cpuLoad: 96, latencyMs: 950 }),
      makeNode({ nodeId: 'node-0003', status: 'WARNING' }),
    ]);
    render(<App />);

    fireEvent.click(screen.getByRole('radio', { name: 'CRITICAL 1' }));
    const rows = screen.getAllByTestId('node-row');
    expect(rows.every((row) => row.dataset['status'] === 'CRITICAL')).toBe(true);

    expect(rows).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'node-0002' }));

    const panel = screen.getByTestId('node-detail');
    expect(within(panel).getByRole('heading', { name: 'node-0002' })).toBeVisible();
    expect(within(panel).getByText('96.0%', { selector: 'dd' })).toBeVisible();
    expect(within(panel).getByText('950 ms', { selector: 'dd' })).toBeVisible();
  });

  it('shows the selected node in the detail panel even after the filter hides it', () => {
    seedFleet([makeNode({ nodeId: 'node-0001', status: 'OK' })]);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'node-0001' }));

    act(() => useUiStore.getState().actions.setStatusFilter('CRITICAL'));

    expect(screen.getByTestId('node-detail')).toHaveTextContent('Hidden by the current filter');
  });

  it('closes the detail drawer from its backdrop', () => {
    seedFleet([makeNode({ nodeId: 'node-0001' })]);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'node-0001' }));

    fireEvent.click(screen.getByRole('button', { name: 'Close node details' }));

    expect(useUiStore.getState().selectedNodeId).toBeNull();
  });
});
