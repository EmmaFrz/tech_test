import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeNode, makeNodes, TEST_TIMESTAMP } from '@/test/factories';

import { historyStore } from './historyStore';
import {
  useFleetMetrics,
  useIsNodeStale,
  useMillisecondsSinceLastMessage,
  useNodeById,
  useNodeHistory,
  useStatusCounts,
  useVisibleNodeIds,
} from './hooks';
import { useTelemetryStore } from './telemetryStore';
import { useUiStore } from './uiStore';
import { ORDER_REFRESH_MS, startVisibleNodesSync, useVisibleNodesStore } from './visibleNodes';

function resetStores(): void {
  useTelemetryStore.setState(useTelemetryStore.getInitialState(), true);
  historyStore.clear();
}

describe('store hooks', () => {
  beforeEach(resetStores);

  describe('useNodeById', () => {
    it('does not re-render when a different node is updated', () => {
      act(() => useTelemetryStore.getState().actions.applySnapshot(makeNodes(2), 1));
      let renders = 0;
      renderHook(() => {
        renders += 1;
        return useNodeById('node-0001');
      });
      const rendersBefore = renders;

      act(() =>
        useTelemetryStore.getState().actions.applyBatch({
          updates: [makeNode({ nodeId: 'node-0002', latencyMs: 999 })],
          serverTime: null,
          receivedAt: 2,
        }),
      );

      expect(renders).toBe(rendersBefore);
    });

    it('re-renders with the new value when its own node is updated', () => {
      act(() => useTelemetryStore.getState().actions.applySnapshot(makeNodes(1), 1));
      const { result } = renderHook(() => useNodeById('node-0001'));

      act(() =>
        useTelemetryStore.getState().actions.applyBatch({
          updates: [makeNode({ latencyMs: 640 })],
          serverTime: null,
          receivedAt: 2,
        }),
      );

      expect(result.current?.latencyMs).toBe(640);
    });

    it('returns undefined for an unknown node', () => {
      const { result } = renderHook(() => useNodeById('missing'));

      expect(result.current).toBeUndefined();
    });
  });

  describe('useIsNodeStale', () => {
    it('flips once the server clock moves past the stale threshold', () => {
      act(() => useTelemetryStore.getState().actions.applySnapshot(makeNodes(1), 1));
      const { result } = renderHook(() => useIsNodeStale('node-0001'));
      expect(result.current).toBe(false);

      act(() =>
        useTelemetryStore.getState().actions.applyBatch({
          updates: [],
          serverTime: TEST_TIMESTAMP + 10_001,
          receivedAt: 2,
        }),
      );

      expect(result.current).toBe(true);
    });
  });

  describe('useFleetMetrics and useStatusCounts', () => {
    it('reflect the nodes in the store', () => {
      act(() =>
        useTelemetryStore
          .getState()
          .actions.applySnapshot(
            [
              makeNode({ nodeId: 'a', status: 'OK', latencyMs: 100 }),
              makeNode({ nodeId: 'b', status: 'CRITICAL', latencyMs: 300 }),
            ],
            1,
          ),
      );

      const metrics = renderHook(() => useFleetMetrics());
      const counts = renderHook(() => useStatusCounts());

      expect(metrics.result.current).toMatchObject({
        activeNodes: 2,
        criticalCount: 1,
        averageLatencyMs: 200,
      });
      expect(counts.result.current).toEqual({ ALL: 2, OK: 1, WARNING: 0, CRITICAL: 1 });
    });

    it('keeps the same metrics object when nothing relevant changed', () => {
      act(() => useTelemetryStore.getState().actions.applySnapshot(makeNodes(2), 1));
      const { result } = renderHook(() => useFleetMetrics());
      const before = result.current;

      act(() => useTelemetryStore.getState().actions.setConnection('live'));

      expect(result.current).toBe(before);
    });
  });

  describe('useNodeHistory', () => {
    it('returns the recorded samples and updates when the node gets new ones', () => {
      const { result } = renderHook(() => useNodeHistory('node-0001'));
      expect(result.current).toEqual([]);

      act(() => historyStore.record([makeNode({ timestamp: TEST_TIMESTAMP + 1 })]));
      act(() => historyStore.record([makeNode({ timestamp: TEST_TIMESTAMP + 2 })]));

      expect(result.current.map((sample) => sample.timestamp)).toEqual([
        TEST_TIMESTAMP + 1,
        TEST_TIMESTAMP + 2,
      ]);
    });

    it('returns no samples without a selected node', () => {
      const { result } = renderHook(() => useNodeHistory(null));

      expect(result.current).toEqual([]);
    });
  });

  describe('useMillisecondsSinceLastMessage', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(10_000);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('is null until the first message arrives', () => {
      const { result } = renderHook(() => useMillisecondsSinceLastMessage(100));

      expect(result.current).toBeNull();
    });

    it('grows with the time elapsed since the latest flush', () => {
      act(() => useTelemetryStore.getState().actions.applySnapshot(makeNodes(1), 9_000));
      const { result } = renderHook(() => useMillisecondsSinceLastMessage(100));
      expect(result.current).toBe(1_000);

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current).toBe(1_300);
    });
  });
});

describe('useVisibleNodeIds', () => {
  let stopSync: () => void;
  let rendered: (readonly string[])[];

  function renderVisibleIds(): void {
    renderHook(() => {
      const ids = useVisibleNodeIds();
      rendered.push(ids);
      return ids;
    });
  }

  function applyUpdates(...updates: ReturnType<typeof makeNode>[]): void {
    act(() =>
      useTelemetryStore.getState().actions.applyBatch({ updates, serverTime: null, receivedAt: 2 }),
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
    resetStores();
    useUiStore.setState(useUiStore.getInitialState(), true);
    useVisibleNodesStore.setState(useVisibleNodesStore.getInitialState(), true);
    stopSync = startVisibleNodesSync();
    rendered = [];
  });

  afterEach(() => {
    stopSync();
    vi.useRealTimers();
  });

  it('renders a sort change first with the list it replaces, then with the new list', () => {
    act(() => useTelemetryStore.getState().actions.applySnapshot(makeNodes(3), 1));
    renderVisibleIds();
    const shown = rendered.at(-1);
    const renderCount = rendered.length;

    act(() => useUiStore.getState().actions.setSort({ key: 'nodeId', direction: 'desc' }));

    expect(rendered).toHaveLength(renderCount + 2);
    expect(rendered[renderCount]).toBe(shown);
    expect(rendered.at(-1)).toEqual(['node-0003', 'node-0002', 'node-0001']);
  });

  it('renders a telemetry reorder at once, in a single render', () => {
    act(() => useUiStore.getState().actions.setSort({ key: 'latencyMs', direction: 'desc' }));
    act(() => useTelemetryStore.getState().actions.applySnapshot(makeNodes(3), 1));
    renderVisibleIds();
    act(() => {
      vi.advanceTimersByTime(ORDER_REFRESH_MS);
    });
    const renderCount = rendered.length;

    applyUpdates(makeNode({ nodeId: 'node-0003', latencyMs: 900, timestamp: TEST_TIMESTAMP + 1 }));

    expect(rendered).toHaveLength(renderCount + 1);
    expect(rendered.at(-1)).toEqual(['node-0003', 'node-0001', 'node-0002']);
  });
});
