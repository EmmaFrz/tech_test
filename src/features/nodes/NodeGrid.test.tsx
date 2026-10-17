import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CRITICAL_PULSE_MS } from '@/domain/criticalEntries';
import { ORDER_REFRESH_MS, useTelemetryStore, useUiStore } from '@/store';
import { makeNode, makeNodes, TEST_TIMESTAMP } from '@/test/factories';
import { mockElementLayout } from '@/test/layout';
import { resetStores, seedFleet, startVisibleNodes } from '@/test/stores';
import type { NodeTelemetry } from '@shared/protocol';

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

  it('mounts new rows without reading their size from the layout', () => {
    seedFleet(makeNodes(200));
    render(<NodeGrid />);
    const offsetHeight = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get');
    offsetHeight.mockClear();

    act(() => useUiStore.getState().actions.setSort({ key: 'nodeId', direction: 'desc' }));

    expect(screen.getAllByTestId('node-row')[0]).toHaveAttribute('data-node-id', 'node-0200');
    expect(offsetHeight).not.toHaveBeenCalled();
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

describe('NodeGrid during live updates', () => {
  let stopSync: () => void;

  function applyUpdates(...updates: readonly NodeTelemetry[]): void {
    act(() =>
      useTelemetryStore.getState().actions.applyBatch({
        updates,
        serverTime: null,
        receivedAt: Date.now(),
      }),
    );
  }

  function refreshOrder(): void {
    act(() => {
      vi.advanceTimersByTime(ORDER_REFRESH_MS);
    });
  }

  function button(nodeId: string): HTMLElement {
    return screen.getByRole('button', { name: nodeId });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    mockElementLayout({ viewportHeight: 440, rowHeight: 44 });
    resetStores();
    stopSync = startVisibleNodes();
  });

  afterEach(() => {
    stopSync();
    vi.useRealTimers();
  });

  describe('keyboard focus', () => {
    it('stays in the grid when a reorder moves the focused row out of the window', () => {
      seedFleet(makeNodes(200));
      act(() => useUiStore.getState().actions.setSort({ key: 'latencyMs', direction: 'desc' }));
      render(<NodeGrid />);
      const first = button('node-0001');
      act(() => first.focus());

      applyUpdates(makeNode({ latencyMs: 1, timestamp: TEST_TIMESTAMP + 1 }));
      refreshOrder();

      expect(first).not.toBeInTheDocument();
      expect(screen.getByRole('grid')).toHaveFocus();
      fireEvent.keyDown(screen.getByRole('grid'), { key: 'ArrowDown' });
      expect(button('node-0002')).toHaveFocus();
    });

    it('keeps focus on a row that a reorder moves within the window', () => {
      seedFleet(makeNodes(5));
      act(() => useUiStore.getState().actions.setSort({ key: 'latencyMs', direction: 'desc' }));
      render(<NodeGrid />);
      act(() => button('node-0001').focus());

      applyUpdates(makeNode({ latencyMs: 1, timestamp: TEST_TIMESTAMP + 1 }));
      refreshOrder();

      expect(screen.getAllByTestId('node-row').at(-1)).toHaveAttribute('data-node-id', 'node-0001');
      expect(button('node-0001')).toHaveFocus();
    });

    it('stays in the grid when the focused node leaves the status filter', () => {
      seedFleet(['a', 'b', 'c'].map((nodeId) => makeNode({ nodeId, status: 'CRITICAL' })));
      act(() => useUiStore.getState().actions.setStatusFilter('CRITICAL'));
      render(<NodeGrid />);
      act(() => button('b').focus());

      applyUpdates(makeNode({ nodeId: 'b', status: 'OK', timestamp: TEST_TIMESTAMP + 1 }));
      refreshOrder();

      expect(screen.queryByRole('button', { name: 'b' })).not.toBeInTheDocument();
      expect(screen.getByRole('grid')).toHaveFocus();
      fireEvent.keyDown(screen.getByRole('grid'), { key: 'ArrowUp' });
      expect(button('a')).toHaveFocus();
    });

    it('stays in the grid when a replacement snapshot drops the focused node', () => {
      seedFleet(makeNodes(3));
      render(<NodeGrid />);
      act(() => button('node-0002').focus());

      seedFleet([makeNode({ nodeId: 'node-0001' }), makeNode({ nodeId: 'node-0003' })]);

      expect(screen.getByRole('grid')).toHaveFocus();
      fireEvent.keyDown(screen.getByRole('grid'), { key: 'ArrowDown' });
      expect(button('node-0003')).toHaveFocus();
    });

    it('leaves focus alone when the user is outside the grid', async () => {
      seedFleet(makeNodes(200));
      act(() => useUiStore.getState().actions.setSort({ key: 'latencyMs', direction: 'desc' }));
      render(
        <>
          <input aria-label="Search" />
          <NodeGrid />
        </>,
      );
      act(() => button('node-0001').focus());
      act(() => screen.getByRole('textbox', { name: 'Search' }).focus());
      await Promise.resolve();

      applyUpdates(makeNode({ latencyMs: 1, timestamp: TEST_TIMESTAMP + 1 }));
      refreshOrder();

      expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus();
    });

    it('does not pull focus back after the user blurred the grid', async () => {
      seedFleet(makeNodes(200));
      act(() => useUiStore.getState().actions.setSort({ key: 'latencyMs', direction: 'desc' }));
      render(<NodeGrid />);
      act(() => button('node-0001').focus());
      act(() => button('node-0001').blur());
      await Promise.resolve();

      applyUpdates(makeNode({ latencyMs: 1, timestamp: TEST_TIMESTAMP + 1 }));
      refreshOrder();

      expect(document.body).toHaveFocus();
    });
  });

  describe('critical pulse', () => {
    function rowOf(nodeId: string): HTMLElement | null {
      return button(nodeId).closest('[role="row"]');
    }

    it('pulses a node that enters CRITICAL while the CRITICAL filter hid it', () => {
      seedFleet([
        makeNode({ nodeId: 'node-0001', status: 'CRITICAL' }),
        makeNode({ nodeId: 'node-0002', status: 'OK' }),
      ]);
      act(() => useUiStore.getState().actions.setStatusFilter('CRITICAL'));
      render(<NodeGrid />);

      applyUpdates(
        makeNode({ nodeId: 'node-0002', status: 'CRITICAL', timestamp: TEST_TIMESTAMP + 1 }),
      );
      refreshOrder();

      expect(rowOf('node-0002')?.className).toMatch(/pulse/);
      expect(rowOf('node-0001')?.className).not.toMatch(/pulse/);
      act(() => {
        vi.advanceTimersByTime(CRITICAL_PULSE_MS);
      });
      expect(rowOf('node-0002')?.className).not.toMatch(/pulse/);
    });

    it('does not pulse a node revealed after its pulse window has passed', () => {
      seedFleet([makeNode({ nodeId: 'node-0001' }), makeNode({ nodeId: 'node-0002' })]);
      act(() => useUiStore.getState().actions.setSearch('0001'));
      render(<NodeGrid />);
      applyUpdates(
        makeNode({ nodeId: 'node-0002', status: 'CRITICAL', timestamp: TEST_TIMESTAMP + 1 }),
      );
      act(() => {
        vi.advanceTimersByTime(CRITICAL_PULSE_MS);
      });
      applyUpdates();

      act(() => useUiStore.getState().actions.setSearch(''));

      expect(rowOf('node-0002')?.className).not.toMatch(/pulse/);
    });

    it('does not pulse nodes that are already critical in the first snapshot', () => {
      seedFleet([makeNode({ status: 'CRITICAL' })]);

      render(<NodeGrid />);

      expect(rowOf('node-0001')?.className).not.toMatch(/pulse/);
    });
  });
});
