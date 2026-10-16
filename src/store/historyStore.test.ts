import { describe, expect, it, vi } from 'vitest';

import { makeNode, TEST_TIMESTAMP } from '@/test/factories';

import { createHistoryStore } from './historyStore';

describe('historyStore', () => {
  it('records one sample per update with the charted metrics', () => {
    const history = createHistoryStore();

    history.record([makeNode({ cpuLoad: 55, memoryUsage: 66, latencyMs: 77 })]);

    expect(history.getSamples('node-0001')).toEqual([
      { timestamp: TEST_TIMESTAMP, cpuLoad: 55, memoryUsage: 66, latencyMs: 77 },
    ]);
  });

  it('returns an empty list for unknown nodes', () => {
    expect(createHistoryStore().getSamples('missing')).toEqual([]);
  });

  it('keeps only the newest samples once the capacity is exceeded', () => {
    const history = createHistoryStore(3);

    for (let index = 0; index < 5; index += 1) {
      history.record([makeNode({ timestamp: TEST_TIMESTAMP + index })]);
    }

    expect(history.getSamples('node-0001').map((sample) => sample.timestamp)).toEqual([
      TEST_TIMESTAMP + 2,
      TEST_TIMESTAMP + 3,
      TEST_TIMESTAMP + 4,
    ]);
  });

  it('skips samples that are not newer than the latest one', () => {
    const history = createHistoryStore();

    history.record([makeNode()]);
    history.record([makeNode({ latencyMs: 999 })]);

    expect(history.getSamples('node-0001')).toHaveLength(1);
  });

  it('returns a stable array until the node receives a new sample', () => {
    const history = createHistoryStore();
    history.record([makeNode()]);
    const first = history.getSamples('node-0001');

    expect(history.getSamples('node-0001')).toBe(first);

    history.record([makeNode({ timestamp: TEST_TIMESTAMP + 1 })]);
    expect(history.getSamples('node-0001')).not.toBe(first);
  });

  it('notifies only the listeners of the node that received samples', () => {
    const history = createHistoryStore();
    const selected = vi.fn();
    const other = vi.fn();
    history.subscribe('node-0001', selected);
    history.subscribe('node-0002', other);

    history.record([makeNode({ nodeId: 'node-0001' })]);

    expect(selected).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it('notifies a listener once per record call even for several samples', () => {
    const history = createHistoryStore();
    const listener = vi.fn();
    history.subscribe('node-0001', listener);

    history.record([
      makeNode({ timestamp: TEST_TIMESTAMP + 1 }),
      makeNode({ timestamp: TEST_TIMESTAMP + 2 }),
    ]);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const history = createHistoryStore();
    const listener = vi.fn();
    const unsubscribe = history.subscribe('node-0001', listener);

    unsubscribe();
    history.record([makeNode()]);

    expect(listener).not.toHaveBeenCalled();
  });

  it('skips an older sample in an update instead of restarting the history', () => {
    const history = createHistoryStore();
    history.record([makeNode({ timestamp: TEST_TIMESTAMP + 10, cpuLoad: 50 })]);

    history.record([makeNode({ timestamp: TEST_TIMESTAMP, cpuLoad: 99 })], 'update');

    expect(history.getSamples('node-0001').map((sample) => sample.cpuLoad)).toEqual([50]);
  });

  describe('snapshots', () => {
    it('restart a history whose clock they move backwards', () => {
      const history = createHistoryStore();
      history.record([makeNode({ timestamp: TEST_TIMESTAMP + 10, cpuLoad: 50 })]);

      history.record([makeNode({ timestamp: TEST_TIMESTAMP, cpuLoad: 20 })], 'snapshot');

      expect(history.getSamples('node-0001')).toEqual([
        { timestamp: TEST_TIMESTAMP, cpuLoad: 20, memoryUsage: 50, latencyMs: 120 },
      ]);
    });

    it('continue a history whose clock they move forwards', () => {
      const history = createHistoryStore();
      history.record([makeNode({ timestamp: TEST_TIMESTAMP })]);

      history.record([makeNode({ timestamp: TEST_TIMESTAMP + 10 })], 'snapshot');

      expect(history.getSamples('node-0001')).toHaveLength(2);
    });

    it('drop the history of every node they no longer list and tell its subscribers', () => {
      const history = createHistoryStore();
      history.record([makeNode({ nodeId: 'kept' }), makeNode({ nodeId: 'removed' })]);
      const removed = vi.fn();
      history.subscribe('removed', removed);

      history.record([makeNode({ nodeId: 'kept' })], 'snapshot');

      expect(history.getSamples('removed')).toEqual([]);
      expect(history.getSamples('kept')).toHaveLength(1);
      expect(removed).toHaveBeenCalledTimes(1);
    });
  });

  it('clears samples and tells subscribers', () => {
    const history = createHistoryStore();
    const listener = vi.fn();
    history.record([makeNode()]);
    history.subscribe('node-0001', listener);

    history.clear();

    expect(history.getSamples('node-0001')).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
