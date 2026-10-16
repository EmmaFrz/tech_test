import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ReactElement } from 'react';

import { useUiStore } from '@/store';
import { makeNode } from '@/test/factories';
import { mockElementLayout } from '@/test/layout';
import { resetStores, seedFleet, startVisibleNodes } from '@/test/stores';

import { NodeGrid } from './NodeGrid';
import { NodeToolbar } from './NodeToolbar';

function Harness(): ReactElement {
  return (
    <>
      <NodeToolbar />
      <NodeGrid />
    </>
  );
}

function visibleNodeIds(): string[] {
  return screen.queryAllByTestId('node-row').map((row) => row.dataset['nodeId'] ?? '');
}

describe('NodeToolbar with NodeGrid', () => {
  let stopSync: () => void;

  beforeEach(() => {
    mockElementLayout({ viewportHeight: 440, rowHeight: 44 });
    resetStores();
    seedFleet([
      makeNode({ nodeId: 'node-0001', status: 'OK', latencyMs: 100, cpuLoad: 10 }),
      makeNode({ nodeId: 'node-0002', status: 'CRITICAL', latencyMs: 900, cpuLoad: 95 }),
      makeNode({ nodeId: 'node-0003', status: 'WARNING', latencyMs: 400, cpuLoad: 80 }),
      makeNode({ nodeId: 'node-0012', status: 'OK', latencyMs: 200, cpuLoad: 30 }),
    ]);
    stopSync = startVisibleNodes();
  });

  afterEach(() => {
    stopSync();
  });

  it('lists the most severe nodes first by default', () => {
    render(<Harness />);

    expect(visibleNodeIds()).toEqual(['node-0002', 'node-0003', 'node-0001', 'node-0012']);
  });

  it('shows the number of nodes in each status next to its filter', () => {
    render(<Harness />);

    expect(screen.getByRole('radio', { name: 'All 4' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'OK 2' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'WARNING 1' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'CRITICAL 1' })).toBeInTheDocument();
  });

  it('narrows the grid to the selected status', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('radio', { name: 'CRITICAL 1' }));

    expect(visibleNodeIds()).toEqual(['node-0002']);
    expect(screen.getByRole('radio', { name: 'CRITICAL 1' })).toBeChecked();
  });

  it('filters by node ID as the user types', () => {
    render(<Harness />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search nodes by ID' }), {
      target: { value: '12' },
    });

    expect(visibleNodeIds()).toEqual(['node-0012']);
    expect(useUiStore.getState().search).toBe('12');
  });

  it('sorts by the chosen key and flips the direction', () => {
    render(<Harness />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), {
      target: { value: 'latencyMs' },
    });
    expect(visibleNodeIds()).toEqual(['node-0002', 'node-0003', 'node-0012', 'node-0001']);

    fireEvent.click(screen.getByRole('button', { name: 'Descending' }));
    expect(visibleNodeIds()).toEqual(['node-0001', 'node-0012', 'node-0003', 'node-0002']);
    expect(screen.getByRole('button', { name: 'Ascending' })).toBeInTheDocument();
  });

  it('keeps the filter counts live while the grid is filtered', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'CRITICAL 1' }));

    act(() => useUiStore.getState().actions.setStatusFilter('ALL'));

    expect(screen.getByRole('radio', { name: 'All 4' })).toBeChecked();
    expect(visibleNodeIds()).toHaveLength(4);
  });
});
