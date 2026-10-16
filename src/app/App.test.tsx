import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ORDER_REFRESH_MS, useTelemetryStore, useUiStore } from '@/store';
import { makeNode, makeNodes, TEST_TIMESTAMP } from '@/test/factories';
import { mockElementLayout, mockNarrowLayout } from '@/test/layout';
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
    expect(screen.getByTestId('connection-status')).toHaveAttribute('data-state', 'offline');
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

describe('App detail panel focus', () => {
  let stopSync: () => void;

  function rowButton(nodeId: string): HTMLElement {
    return screen.getByRole('button', { name: nodeId, hidden: true });
  }

  function openWithKeyboard(nodeId: string): void {
    act(() => rowButton(nodeId).focus());
    fireEvent.click(rowButton(nodeId));
  }

  function isInert(element: Element): boolean {
    return element.closest('[inert]') !== null;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    mockElementLayout({ viewportHeight: 440, rowHeight: 44 });
    resetStores();
    stopSync = startVisibleNodes();
    seedFleet(makeNodes(5));
  });

  afterEach(() => {
    stopSync();
    vi.useRealTimers();
  });

  describe('as a drawer on narrow screens', () => {
    beforeEach(() => {
      mockNarrowLayout();
    });

    it('moves focus into the drawer and takes the regions it covers out of reach', () => {
      render(<App />);

      openWithKeyboard('node-0002');

      expect(screen.getByTestId('node-detail')).toHaveFocus();
      expect(isInert(screen.getByTestId('node-grid'))).toBe(true);
      expect(isInert(screen.getByTestId('node-detail'))).toBe(false);
      expect(isInert(screen.getByRole('toolbar', { name: 'Node filters', hidden: true }))).toBe(
        true,
      );
      expect(isInert(screen.getByRole('region', { name: 'Fleet overview', hidden: true }))).toBe(
        true,
      );
      expect(isInert(screen.getByRole('button', { name: 'Pause' }))).toBe(false);
      expect(isInert(screen.getByTestId('connection-status'))).toBe(false);
    });

    it.each([
      ['the Close button', () => fireEvent.click(screen.getByRole('button', { name: 'Close' }))],
      ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
      [
        'the backdrop',
        () => fireEvent.click(screen.getByRole('button', { name: 'Close node details' })),
      ],
    ])('returns focus to the row that opened it when closed with %s', (_, close) => {
      render(<App />);
      openWithKeyboard('node-0002');

      close();

      expect(rowButton('node-0002')).toHaveFocus();
      expect(isInert(screen.getByTestId('node-grid'))).toBe(false);
    });

    it('falls back to the grid when the row left the list while the drawer was open', () => {
      seedFleet(['a', 'b', 'c'].map((nodeId) => makeNode({ nodeId, status: 'CRITICAL' })));
      act(() => useUiStore.getState().actions.setStatusFilter('CRITICAL'));
      render(<App />);
      openWithKeyboard('b');
      act(() =>
        useTelemetryStore.getState().actions.applyBatch({
          updates: [makeNode({ nodeId: 'b', status: 'OK', timestamp: TEST_TIMESTAMP + 1 })],
          serverTime: null,
          receivedAt: Date.now(),
        }),
      );
      act(() => {
        vi.advanceTimersByTime(ORDER_REFRESH_MS);
      });

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      expect(screen.queryByRole('button', { name: 'b' })).not.toBeInTheDocument();
      expect(screen.getByRole('grid')).toHaveFocus();
    });

    it('keeps focus in the header when the drawer is closed from there', () => {
      render(<App />);
      openWithKeyboard('node-0002');
      const pause = screen.getByRole('button', { name: 'Pause' });
      act(() => pause.focus());

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(pause).toHaveFocus();
    });
  });

  describe('beside the grid on wide screens', () => {
    it('leaves focus on the row and the grid usable while the panel is open', () => {
      render(<App />);

      openWithKeyboard('node-0002');

      expect(rowButton('node-0002')).toHaveFocus();
      expect(isInert(screen.getByTestId('node-grid'))).toBe(false);
    });

    it('returns focus to the row after the focused Close button disappears', () => {
      render(<App />);
      openWithKeyboard('node-0002');
      const close = screen.getByRole('button', { name: 'Close' });
      act(() => close.focus());

      fireEvent.click(close);

      expect(rowButton('node-0002')).toHaveFocus();
    });
  });
});
