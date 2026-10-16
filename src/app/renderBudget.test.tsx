import { act, render, screen } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReactElement } from 'react';

import { ORDER_REFRESH_MS, useTelemetryStore, useUiStore } from '@/store';
import { makeNode, makeNodes, TEST_TIMESTAMP } from '@/test/factories';
import { mockElementLayout } from '@/test/layout';
import { MockWebSocket } from '@/test/MockWebSocket';
import { resetStores } from '@/test/stores';
import type { BadgeProps } from '@/ui';

import { App } from './App';
import { startTelemetry } from './startTelemetry';

const badgeRenders = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/ui/Badge', async (importOriginal) => {
  const actual = await importOriginal<{ Badge: (props: BadgeProps) => ReactElement }>();
  return {
    Badge: (props: BadgeProps): ReactElement => {
      badgeRenders.count += 1;
      return actual.Badge(props);
    },
  };
});

describe('render budget (NFR-02 and NFR-03)', () => {
  let frameCallbacks: (() => void)[];
  let commits: number;
  let stop: () => void;

  function runFrame(): void {
    const due = frameCallbacks;
    frameCallbacks = [];
    act(() => due.forEach((callback) => callback()));
  }

  function deltaMessage(seq: number, nodeIds: readonly string[]): unknown {
    return {
      type: 'delta',
      seq,
      updates: nodeIds.map((nodeId) =>
        makeNode({ nodeId, latencyMs: 100 + seq, timestamp: TEST_TIMESTAMP + seq }),
      ),
    };
  }

  function criticalDelta(seq: number, nodeId: string): unknown {
    return {
      type: 'delta',
      seq,
      updates: [makeNode({ nodeId, status: 'CRITICAL', timestamp: TEST_TIMESTAMP + seq })],
    };
  }

  function firstRowNodeId(): string | null {
    return screen.getAllByTestId('node-row')[0]?.getAttribute('data-node-id') ?? null;
  }

  function advance(ms: number): void {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    mockElementLayout({ viewportHeight: 440, rowHeight: 44 });
    MockWebSocket.reset();
    resetStores();
    frameCallbacks = [];
    commits = 0;
    stop = startTelemetry({
      createSocket: MockWebSocket.create,
      requestFrame: (callback) => frameCallbacks.push(callback),
      cancelFrame: () => undefined,
    });
    act(() => {
      MockWebSocket.latest().simulateMessage({ type: 'snapshot', seq: 1, nodes: makeNodes(200) });
    });
    render(
      <Profiler id="app" onRender={() => (commits += 1)}>
        <App />
      </Profiler>,
    );
    commits = 0;
    badgeRenders.count = 0;
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it('commits once per frame no matter how many messages arrive in it', () => {
    const socket = MockWebSocket.latest();
    for (let seq = 2; seq < 62; seq += 1) {
      socket.simulateMessage(deltaMessage(seq, ['node-0001', 'node-0002', 'node-0003']));
    }
    expect(commits).toBe(0);

    runFrame();

    expect(commits).toBe(1);
  });

  it('re-renders only the rows whose node changed', () => {
    const socket = MockWebSocket.latest();
    socket.simulateMessage(deltaMessage(2, ['node-0001', 'node-0002', 'node-0003']));

    runFrame();

    expect(badgeRenders.count).toBe(3);
  });

  it('does not re-render any row for a heartbeat-only frame', () => {
    MockWebSocket.latest().simulateMessage({
      type: 'heartbeat',
      seq: 2,
      serverTime: TEST_TIMESTAMP + 2_000,
    });

    runFrame();

    expect(badgeRenders.count).toBe(0);
  });

  it('keeps the node map reference stable for nodes that were not updated', () => {
    const before = useTelemetryStore.getState().byId;
    MockWebSocket.latest().simulateMessage(deltaMessage(2, ['node-0001']));

    runFrame();

    const after = useTelemetryStore.getState().byId;
    expect(after['node-0001']).not.toBe(before['node-0001']);
    expect(after['node-0002']).toBe(before['node-0002']);
    expect(after['node-0200']).toBe(before['node-0200']);
  });

  describe('order and membership changes', () => {
    it('commits once when a flush also refreshes the row order', () => {
      advance(ORDER_REFRESH_MS);
      commits = 0;
      MockWebSocket.latest().simulateMessage(criticalDelta(2, 'node-0010'));

      runFrame();

      expect(commits).toBe(1);
      expect(firstRowNodeId()).toBe('node-0010');
    });

    // Advancing the clock also ticks the "updated Xs ago" timers, which commit on their own, so
    // commits are counted from the frame on.
    it('runs a reorder that falls due between flushes inside the next frame, in its commit', () => {
      const socket = MockWebSocket.latest();
      advance(ORDER_REFRESH_MS / 2);
      socket.simulateMessage(criticalDelta(2, 'node-0010'));
      runFrame();
      expect(firstRowNodeId()).toBe('node-0001');

      advance(ORDER_REFRESH_MS / 2);
      expect(firstRowNodeId()).toBe('node-0001');
      commits = 0;
      socket.simulateMessage(deltaMessage(3, ['node-0002']));
      runFrame();

      expect(commits).toBe(1);
      expect(firstRowNodeId()).toBe('node-0010');
    });

    it('commits a due reorder once even when no telemetry arrives in its frame', () => {
      advance(ORDER_REFRESH_MS / 2);
      MockWebSocket.latest().simulateMessage(criticalDelta(2, 'node-0010'));
      runFrame();

      advance(ORDER_REFRESH_MS / 2);
      expect(firstRowNodeId()).toBe('node-0001');
      commits = 0;
      runFrame();

      expect(commits).toBe(1);
      expect(firstRowNodeId()).toBe('node-0010');
    });

    it('commits once when a node enters the active status filter', () => {
      act(() => useUiStore.getState().actions.setStatusFilter('CRITICAL'));
      advance(ORDER_REFRESH_MS);
      commits = 0;
      MockWebSocket.latest().simulateMessage(criticalDelta(2, 'node-0042'));

      runFrame();

      expect(commits).toBe(1);
      expect(screen.getAllByTestId('node-row').map((row) => row.dataset['nodeId'])).toEqual([
        'node-0042',
      ]);
    });
  });
});
