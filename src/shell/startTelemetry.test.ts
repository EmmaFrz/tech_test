import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { historyStore, useTelemetryStore, useVisibleNodesStore } from '@/store';
import { selectFleetMetrics } from '@/store/selectors';
import { makeNode, makeNodes, TEST_TIMESTAMP } from '@/test/factories';
import { MockWebSocket } from '@/test/MockWebSocket';

import { startTelemetry } from './startTelemetry';

describe('startTelemetry', () => {
  let frameCallbacks: (() => void)[];
  let stop: () => void;

  function runFrame(): void {
    const due = frameCallbacks;
    frameCallbacks = [];
    act(() => due.forEach((callback) => callback()));
  }

  beforeEach(() => {
    MockWebSocket.reset();
    frameCallbacks = [];
    useTelemetryStore.setState(useTelemetryStore.getInitialState(), true);
    useVisibleNodesStore.setState(useVisibleNodesStore.getInitialState(), true);
    historyStore.clear();
    stop = startTelemetry({
      createSocket: MockWebSocket.create,
      requestFrame: (callback) => frameCallbacks.push(callback),
      cancelFrame: () => undefined,
    });
  });

  afterEach(() => {
    stop();
  });

  it('connects to the same-origin WebSocket endpoint', () => {
    expect(MockWebSocket.latest().url).toBe(`ws://${window.location.host}/ws`);
    expect(useTelemetryStore.getState().connection).toBe('connecting');
  });

  it('loads a snapshot straight into the store and the visible list', () => {
    act(() =>
      MockWebSocket.latest().simulateMessage({ type: 'snapshot', seq: 1, nodes: makeNodes(3) }),
    );

    const state = useTelemetryStore.getState();
    expect(state.connection).toBe('live');
    expect(Object.keys(state.byId)).toHaveLength(3);
    expect(useVisibleNodesStore.getState().ids).toHaveLength(3);
    expect(historyStore.getSamples('node-0001')).toHaveLength(1);
  });

  it('applies many deltas as a single store update on the next frame', () => {
    const socket = MockWebSocket.latest();
    act(() => socket.simulateMessage({ type: 'snapshot', seq: 1, nodes: makeNodes(2) }));
    let storeUpdates = 0;
    const unsubscribe = useTelemetryStore.subscribe(() => {
      storeUpdates += 1;
    });

    for (let seq = 2; seq < 22; seq += 1) {
      socket.simulateMessage({
        type: 'delta',
        seq,
        updates: [makeNode({ latencyMs: seq * 10, timestamp: TEST_TIMESTAMP + seq })],
      });
    }
    expect(storeUpdates).toBe(0);
    runFrame();
    unsubscribe();

    expect(storeUpdates).toBe(1);
    expect(useTelemetryStore.getState().byId['node-0001']?.latencyMs).toBe(210);
  });

  it('drops pending deltas when a new snapshot arrives', () => {
    const socket = MockWebSocket.latest();
    act(() => socket.simulateMessage({ type: 'snapshot', seq: 1, nodes: makeNodes(1) }));
    socket.simulateMessage({ type: 'delta', seq: 2, updates: [makeNode({ latencyMs: 999 })] });

    act(() => socket.simulateMessage({ type: 'snapshot', seq: 3, nodes: makeNodes(1) }));
    runFrame();

    expect(useTelemetryStore.getState().byId['node-0001']?.latencyMs).toBe(120);
  });

  it('drops impossible clock values and keeps the last valid server clock and fleet', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const socket = MockWebSocket.latest();
    act(() => socket.simulateMessage({ type: 'snapshot', seq: 1, nodes: makeNodes(2) }));

    socket.simulateMessage({ type: 'heartbeat', seq: 2, serverTime: 1e100 });
    socket.simulateMessage({
      type: 'delta',
      seq: 3,
      updates: [makeNode({ timestamp: 1e20, cpuLoad: 99 })],
    });
    runFrame();

    const state = useTelemetryStore.getState();
    expect(state.serverTime).toBe(TEST_TIMESTAMP);
    expect(state.byId['node-0001']?.cpuLoad).toBe(40);
    expect(selectFleetMetrics(state).activeNodes).toBe(2);

    socket.simulateMessage({ type: 'heartbeat', seq: 4, serverTime: TEST_TIMESTAMP + 2_000 });
    runFrame();
    expect(useTelemetryStore.getState().serverTime).toBe(TEST_TIMESTAMP + 2_000);
  });

  it('marks the store offline once stopped', () => {
    stop();

    expect(useTelemetryStore.getState().connection).toBe('offline');
  });
});
