import { describe, expect, it } from 'vitest';

import type { SortKey } from './sorters';

import { makeNode } from '@/test/factories';
import type { NodeTelemetry } from '@shared/protocol';

import { compareNodes, DEFAULT_SORT, SORT_KEYS, sortNodes } from './sorters';

const nodes = [
  makeNode({
    nodeId: 'node-0002',
    status: 'WARNING',
    cpuLoad: 80,
    memoryUsage: 30,
    latencyMs: 400,
  }),
  makeNode({ nodeId: 'node-0010', status: 'OK', cpuLoad: 10, memoryUsage: 90, latencyMs: 50 }),
  makeNode({
    nodeId: 'node-0001',
    status: 'CRITICAL',
    cpuLoad: 95,
    memoryUsage: 60,
    latencyMs: 900,
  }),
];

function idsSortedBy(key: SortKey, direction: 'asc' | 'desc'): string[] {
  return sortNodes(nodes, { key, direction }).map((node) => node.nodeId);
}

describe('sortNodes', () => {
  it.each([
    ['status', ['node-0010', 'node-0002', 'node-0001']],
    ['latencyMs', ['node-0010', 'node-0002', 'node-0001']],
    ['cpuLoad', ['node-0010', 'node-0002', 'node-0001']],
    ['memoryUsage', ['node-0002', 'node-0001', 'node-0010']],
    ['nodeId', ['node-0001', 'node-0002', 'node-0010']],
  ] as const)('sorts by %s ascending', (key, expected) => {
    expect(idsSortedBy(key, 'asc')).toEqual(expected);
  });

  it.each(SORT_KEYS)('reverses the order of %s when descending', (key) => {
    expect(idsSortedBy(key, 'desc')).toEqual(idsSortedBy(key, 'asc').reverse());
  });

  it('orders node IDs numerically rather than alphabetically', () => {
    const ids = sortNodes([makeNode({ nodeId: 'node-100' }), makeNode({ nodeId: 'node-20' })], {
      key: 'nodeId',
      direction: 'asc',
    }).map((node) => node.nodeId);

    expect(ids).toEqual(['node-20', 'node-100']);
  });

  it('breaks ties by ascending node ID in both directions', () => {
    const tied = [
      makeNode({ nodeId: 'node-0003', latencyMs: 100 }),
      makeNode({ nodeId: 'node-0001', latencyMs: 100 }),
      makeNode({ nodeId: 'node-0002', latencyMs: 100 }),
    ];

    const ascending = sortNodes(tied, { key: 'latencyMs', direction: 'asc' });
    const descending = sortNodes(tied, { key: 'latencyMs', direction: 'desc' });

    expect(ascending.map((node) => node.nodeId)).toEqual(['node-0001', 'node-0002', 'node-0003']);
    expect(descending.map((node) => node.nodeId)).toEqual(['node-0001', 'node-0002', 'node-0003']);
  });

  it('does not mutate the input array', () => {
    const before = nodes.map((node) => node.nodeId);

    sortNodes(nodes, { key: 'nodeId', direction: 'asc' });

    expect(nodes.map((node) => node.nodeId)).toEqual(before);
  });
});

describe('sortNodes against the reference order of compareNodes', () => {
  const STATUSES = ['OK', 'WARNING', 'CRITICAL'] as const;

  // Few distinct values and shuffled, unpadded IDs: nearly every comparison is a tie.
  function tiedFleet(size: number, seed: number): NodeTelemetry[] {
    let state = seed;
    const next = (limit: number): number => {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state % limit;
    };
    const fleet = Array.from({ length: size }, (_, index) =>
      makeNode({
        nodeId: `node-${index * 7 + 1}`,
        status: STATUSES[next(3)] ?? 'OK',
        cpuLoad: next(4) * 10,
        memoryUsage: next(3) * 25,
        latencyMs: 100 + next(5) * 50,
      }),
    );
    return fleet.sort(() => next(3) - 1);
  }

  it.each(
    SORT_KEYS.flatMap((key) =>
      (['asc', 'desc'] as const).map((direction) => [key, direction] as const),
    ),
  )('orders a fleet full of ties by %s %s exactly like compareNodes', (key, direction) => {
    const sort = { key, direction };
    const fleet = tiedFleet(300, key.length * 31 + direction.length);

    expect(sortNodes(fleet, sort)).toEqual([...fleet].sort(compareNodes(sort)));
  });

  it('ranks node IDs that only appear after an earlier sort', () => {
    sortNodes(tiedFleet(50, 7), DEFAULT_SORT);
    const grown = [
      ...tiedFleet(50, 7),
      makeNode({ nodeId: 'node-0', latencyMs: 100 }),
      makeNode({ nodeId: 'node-1000', latencyMs: 100 }),
    ];
    const sort = { key: 'latencyMs', direction: 'asc' } as const;

    expect(sortNodes(grown, sort)).toEqual([...grown].sort(compareNodes(sort)));
  });
});

describe('compareNodes', () => {
  it('returns zero only for the same node', () => {
    const [first] = nodes;
    if (first === undefined) {
      throw new Error('fixture is empty');
    }

    expect(compareNodes(DEFAULT_SORT)(first, first)).toBe(0);
  });
});

describe('DEFAULT_SORT', () => {
  it('puts the most severe nodes first', () => {
    expect(sortNodes(nodes, DEFAULT_SORT)[0]?.status).toBe('CRITICAL');
  });
});
