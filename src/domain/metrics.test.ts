import { describe, expect, it } from 'vitest';

import { makeNode, TEST_TIMESTAMP } from '@/test/factories';

import { computeFleetMetrics, isNodeStale, STALE_AFTER_MS } from './metrics';

describe('isNodeStale', () => {
  const node = makeNode({ timestamp: TEST_TIMESTAMP });

  it('is never stale before the server clock is known', () => {
    expect(isNodeStale(node, null)).toBe(false);
  });

  it('is not stale at exactly the threshold', () => {
    expect(isNodeStale(node, TEST_TIMESTAMP + STALE_AFTER_MS)).toBe(false);
  });

  it('is stale once silent for longer than the threshold', () => {
    expect(isNodeStale(node, TEST_TIMESTAMP + STALE_AFTER_MS + 1)).toBe(true);
  });
});

describe('computeFleetMetrics', () => {
  it('counts active, critical and warning nodes and averages latency', () => {
    const nodes = [
      makeNode({ nodeId: 'a', status: 'OK', latencyMs: 100 }),
      makeNode({ nodeId: 'b', status: 'WARNING', latencyMs: 300 }),
      makeNode({ nodeId: 'c', status: 'CRITICAL', latencyMs: 800 }),
      makeNode({ nodeId: 'd', status: 'CRITICAL', latencyMs: 400 }),
    ];

    expect(computeFleetMetrics(nodes, TEST_TIMESTAMP)).toEqual({
      totalNodes: 4,
      activeNodes: 4,
      staleNodes: 0,
      criticalCount: 2,
      warningCount: 1,
      averageLatencyMs: 400,
    });
  });

  it('excludes stale nodes from every figure but the totals', () => {
    const nodes = [
      makeNode({ nodeId: 'fresh', status: 'OK', latencyMs: 100, timestamp: TEST_TIMESTAMP }),
      makeNode({
        nodeId: 'silent',
        status: 'CRITICAL',
        latencyMs: 900,
        timestamp: TEST_TIMESTAMP - STALE_AFTER_MS - 1,
      }),
    ];

    expect(computeFleetMetrics(nodes, TEST_TIMESTAMP)).toEqual({
      totalNodes: 2,
      activeNodes: 1,
      staleNodes: 1,
      criticalCount: 0,
      warningCount: 0,
      averageLatencyMs: 100,
    });
  });

  it('reports no average latency when there are no active nodes', () => {
    expect(computeFleetMetrics([], null).averageLatencyMs).toBeNull();
    expect(
      computeFleetMetrics([makeNode({ timestamp: TEST_TIMESTAMP - 60_000 })], TEST_TIMESTAMP)
        .averageLatencyMs,
    ).toBeNull();
  });
});
