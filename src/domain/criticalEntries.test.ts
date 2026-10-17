import { describe, expect, it } from 'vitest';

import { createDictionary } from '@/lib/dictionary';
import { makeNode } from '@/test/factories';
import type { NodeStatus, NodeTelemetry } from '@shared/protocol';

import { CRITICAL_PULSE_MS, trackCriticalEntries } from './criticalEntries';

function fleet(...nodes: readonly NodeTelemetry[]): Record<string, NodeTelemetry> {
  const byId = createDictionary<NodeTelemetry>();
  for (const node of nodes) {
    byId[node.nodeId] = node;
  }
  return byId;
}

function withStatus(nodeId: string, status: NodeStatus): NodeTelemetry {
  return makeNode({ nodeId, status });
}

describe('trackCriticalEntries', () => {
  const none = createDictionary<number>();

  it('records a node that moves from another status into CRITICAL', () => {
    const before = fleet(withStatus('a', 'OK'), withStatus('b', 'WARNING'));
    const changed = [withStatus('a', 'CRITICAL'), withStatus('b', 'CRITICAL')];

    const entries = trackCriticalEntries(none, {
      previous: before,
      next: fleet(...changed),
      changed,
      at: 500,
    });

    expect(entries).toEqual({ a: 500, b: 500 });
  });

  it('ignores nodes seen for the first time, so the first snapshot never pulses', () => {
    const nodes = [withStatus('a', 'CRITICAL')];

    const entries = trackCriticalEntries(none, {
      previous: fleet(),
      next: fleet(...nodes),
      changed: nodes,
      at: 500,
    });

    expect(entries).toBe(none);
  });

  it('does not record a node that was already CRITICAL', () => {
    const changed = [withStatus('a', 'CRITICAL')];

    const entries = trackCriticalEntries(none, {
      previous: fleet(withStatus('a', 'CRITICAL')),
      next: fleet(...changed),
      changed,
      at: 500,
    });

    expect(entries).toBe(none);
  });

  it('keeps an entry for the pulse window and expires it afterwards', () => {
    const shown = fleet(withStatus('a', 'CRITICAL'));
    const entries = { a: 1_000 };
    const quiet = { previous: shown, next: shown, changed: [] };

    expect(trackCriticalEntries(entries, { ...quiet, at: 1_000 + CRITICAL_PULSE_MS - 1 })).toBe(
      entries,
    );
    expect(trackCriticalEntries(entries, { ...quiet, at: 1_000 + CRITICAL_PULSE_MS })).toEqual({});
  });

  it('forgets a node that leaves CRITICAL or the fleet', () => {
    const entries = { a: 1_000, b: 1_000 };
    const changed = [withStatus('a', 'OK')];

    const tracked = trackCriticalEntries(entries, {
      previous: fleet(withStatus('a', 'CRITICAL'), withStatus('b', 'CRITICAL')),
      next: fleet(...changed),
      changed,
      at: 1_100,
    });

    expect(tracked).toEqual({});
  });

  it('handles node IDs that are also Object.prototype keys', () => {
    const changed = [withStatus('__proto__', 'CRITICAL'), withStatus('toString', 'CRITICAL')];

    const entries = trackCriticalEntries(none, {
      previous: fleet(withStatus('__proto__', 'OK'), withStatus('toString', 'OK')),
      next: fleet(...changed),
      changed,
      at: 700,
    });

    expect(Object.keys(entries)).toEqual(['__proto__', 'toString']);
    expect(entries['__proto__']).toBe(700);
    expect(Object.getPrototypeOf(entries)).toBeNull();
  });
});
