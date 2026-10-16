import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TelemetryStore } from './telemetryStore';

import { makeNode, makeNodes, TEST_TIMESTAMP } from '@/test/factories';

import { createTelemetryStore } from './telemetryStore';

function batch(updates: ReturnType<typeof makeNodes>, serverTime: number | null = null) {
  return { updates, serverTime, receivedAt: 1_000 };
}

describe('telemetryStore', () => {
  const record = vi.fn();
  let store: TelemetryStore;

  beforeEach(() => {
    record.mockClear();
    store = createTelemetryStore({ record });
  });

  describe('applySnapshot', () => {
    it('replaces the whole state with the snapshot nodes', () => {
      const { actions } = store.getState();
      actions.applySnapshot(makeNodes(3), 10);

      actions.applySnapshot([makeNode({ nodeId: 'node-0099' })], 20);

      const state = store.getState();
      expect(Object.keys(state.byId)).toEqual(['node-0099']);
      expect(state.lastMessageAt).toBe(20);
      expect(state.serverTime).toBe(TEST_TIMESTAMP);
    });

    it('discards updates that were buffered while paused', () => {
      const { actions } = store.getState();
      actions.applySnapshot(makeNodes(1), 1);
      actions.pause();
      actions.applyBatch(batch([makeNode({ latencyMs: 777 })]));

      actions.applySnapshot(makeNodes(1), 2);
      actions.resume();

      expect(store.getState().byId['node-0001']?.latencyMs).toBe(120);
    });

    it('records the snapshot nodes in the history', () => {
      const nodes = makeNodes(2);

      store.getState().actions.applySnapshot(nodes, 1);

      expect(record).toHaveBeenCalledWith(nodes);
    });
  });

  describe('applyBatch', () => {
    it('updates only the reported nodes and keeps other references', () => {
      const { actions } = store.getState();
      actions.applySnapshot(makeNodes(3), 1);
      const before = store.getState().byId;

      actions.applyBatch(batch([makeNode({ nodeId: 'node-0002', latencyMs: 500 })]));

      const after = store.getState().byId;
      expect(after['node-0002']?.latencyMs).toBe(500);
      expect(after['node-0001']).toBe(before['node-0001']);
      expect(after['node-0003']).toBe(before['node-0003']);
      expect(after).not.toBe(before);
    });

    it('keeps the same node map when the batch has no updates', () => {
      const { actions } = store.getState();
      actions.applySnapshot(makeNodes(2), 1);
      const before = store.getState().byId;

      actions.applyBatch(batch([], TEST_TIMESTAMP + 2_000));

      expect(store.getState().byId).toBe(before);
      expect(store.getState().serverTime).toBe(TEST_TIMESTAMP + 2_000);
    });

    it('never moves the server clock backwards', () => {
      const { actions } = store.getState();
      actions.applySnapshot(makeNodes(1), 1);

      actions.applyBatch(batch([], TEST_TIMESTAMP - 5_000));

      expect(store.getState().serverTime).toBe(TEST_TIMESTAMP);
    });

    it('advances the server clock with newer node timestamps', () => {
      const { actions } = store.getState();
      actions.applySnapshot(makeNodes(1), 1);

      actions.applyBatch(batch([makeNode({ timestamp: TEST_TIMESTAMP + 300 })]));

      expect(store.getState().serverTime).toBe(TEST_TIMESTAMP + 300);
    });

    it('records the applied updates in the history', () => {
      const updates = [makeNode({ latencyMs: 130 })];

      store.getState().actions.applyBatch(batch(updates));

      expect(record).toHaveBeenLastCalledWith(updates);
    });
  });

  describe('pause and resume', () => {
    it('freezes the node map while paused but keeps the connection indicator alive', () => {
      const { actions } = store.getState();
      actions.applySnapshot(makeNodes(1), 1);
      actions.pause();
      const frozen = store.getState().byId;

      actions.applyBatch({
        updates: [makeNode({ latencyMs: 900 })],
        serverTime: null,
        receivedAt: 55,
      });

      expect(store.getState().byId).toBe(frozen);
      expect(store.getState().lastMessageAt).toBe(55);
      expect(record).toHaveBeenCalledTimes(1);
    });

    it('applies only the latest buffered state per node on resume', () => {
      const { actions } = store.getState();
      actions.applySnapshot(makeNodes(2), 1);
      actions.pause();
      actions.applyBatch(batch([makeNode({ latencyMs: 200 })]));
      actions.applyBatch(batch([makeNode({ latencyMs: 300 })], TEST_TIMESTAMP + 4_000));

      actions.resume();

      const state = store.getState();
      expect(state.paused).toBe(false);
      expect(state.byId['node-0001']?.latencyMs).toBe(300);
      expect(state.serverTime).toBe(TEST_TIMESTAMP + 4_000);
      expect(record).toHaveBeenLastCalledWith([makeNode({ latencyMs: 300 })]);
    });

    it('resumes cleanly when nothing was buffered', () => {
      const { actions } = store.getState();
      actions.applySnapshot(makeNodes(1), 1);
      const before = store.getState().byId;

      actions.pause();
      actions.resume();

      expect(store.getState().byId).toBe(before);
      expect(store.getState().paused).toBe(false);
    });
  });

  it('stores the connection state', () => {
    store.getState().actions.setConnection('reconnecting');

    expect(store.getState().connection).toBe('reconnecting');
  });
});
