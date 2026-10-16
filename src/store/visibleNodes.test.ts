import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeNode, TEST_TIMESTAMP } from '@/test/factories';

import { createTelemetryStore } from './telemetryStore';
import { createUiStore } from './uiStore';
import { createVisibleNodesStore, ORDER_REFRESH_MS, startVisibleNodesSync } from './visibleNodes';

describe('startVisibleNodesSync', () => {
  const telemetry = createTelemetryStore({ record: () => undefined });
  const ui = createUiStore();
  const target = createVisibleNodesStore();
  let stop: () => void;

  function nodesWithLatency(first: number, second: number) {
    return [
      makeNode({ nodeId: 'node-0001', latencyMs: first, timestamp: TEST_TIMESTAMP }),
      makeNode({ nodeId: 'node-0002', latencyMs: second, timestamp: TEST_TIMESTAMP }),
    ];
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TEST_TIMESTAMP);
    telemetry.setState(telemetry.getInitialState(), true);
    ui.setState(ui.getInitialState(), true);
    target.setState(target.getInitialState(), true);
    ui.getState().actions.setSort({ key: 'latencyMs', direction: 'desc' });
    stop = startVisibleNodesSync({ telemetry, ui, target });
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it('lists the ids of the snapshot sorted by the active sort', () => {
    telemetry.getState().actions.applySnapshot(nodesWithLatency(100, 200), 1);

    expect(target.getState().ids).toEqual(['node-0002', 'node-0001']);
  });

  it('applies filter, search and sort changes immediately', () => {
    telemetry
      .getState()
      .actions.applySnapshot(
        [
          makeNode({ nodeId: 'node-0001', status: 'OK' }),
          makeNode({ nodeId: 'node-0002', status: 'CRITICAL' }),
          makeNode({ nodeId: 'node-0012', status: 'CRITICAL' }),
        ],
        1,
      );

    ui.getState().actions.setStatusFilter('CRITICAL');
    expect(target.getState().ids).toEqual(['node-0002', 'node-0012']);

    ui.getState().actions.setSearch('12');
    expect(target.getState().ids).toEqual(['node-0012']);
  });

  it('refreshes the order at most once per interval while data keeps changing', () => {
    const { actions } = telemetry.getState();
    actions.applySnapshot(nodesWithLatency(100, 200), 1);

    actions.applyBatch({
      updates: [makeNode({ nodeId: 'node-0001', latencyMs: 900, timestamp: TEST_TIMESTAMP + 100 })],
      serverTime: null,
      receivedAt: 2,
    });
    expect(target.getState().ids).toEqual(['node-0002', 'node-0001']);

    vi.advanceTimersByTime(ORDER_REFRESH_MS - 1);
    expect(target.getState().ids).toEqual(['node-0002', 'node-0001']);

    vi.advanceTimersByTime(1);
    expect(target.getState().ids).toEqual(['node-0001', 'node-0002']);
  });

  it('recomputes right away once the interval has elapsed', () => {
    const { actions } = telemetry.getState();
    actions.applySnapshot(nodesWithLatency(100, 200), 1);
    vi.advanceTimersByTime(ORDER_REFRESH_MS);

    actions.applyBatch({
      updates: [makeNode({ nodeId: 'node-0001', latencyMs: 900, timestamp: TEST_TIMESTAMP + 100 })],
      serverTime: null,
      receivedAt: 2,
    });

    expect(target.getState().ids).toEqual(['node-0001', 'node-0002']);
  });

  it('keeps the list reference when a refresh produces the same order', () => {
    const { actions } = telemetry.getState();
    actions.applySnapshot(nodesWithLatency(100, 200), 1);
    const before = target.getState().ids;

    vi.advanceTimersByTime(ORDER_REFRESH_MS);
    actions.applyBatch({
      updates: [makeNode({ nodeId: 'node-0001', latencyMs: 110, timestamp: TEST_TIMESTAMP + 100 })],
      serverTime: null,
      receivedAt: 2,
    });

    expect(target.getState().ids).toBe(before);
  });

  it('settles the list as soon as the view is paused', () => {
    const { actions } = telemetry.getState();
    actions.applySnapshot(nodesWithLatency(100, 200), 1);
    actions.applyBatch({
      updates: [makeNode({ nodeId: 'node-0001', latencyMs: 900, timestamp: TEST_TIMESTAMP + 100 })],
      serverTime: null,
      receivedAt: 2,
    });

    actions.pause();

    expect(target.getState().ids).toEqual(['node-0001', 'node-0002']);
  });

  it('stops reacting after the synchronization is stopped', () => {
    stop();

    telemetry.getState().actions.applySnapshot(nodesWithLatency(100, 200), 1);
    ui.getState().actions.setSearch('0001');

    expect(target.getState().ids).toEqual([]);
  });
});
