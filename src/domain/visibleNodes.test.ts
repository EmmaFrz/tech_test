import { describe, expect, it } from 'vitest';

import { makeNode } from '@/test/factories';

import { selectVisibleNodeIds } from './visibleNodes';

const nodes = [
  makeNode({ nodeId: 'node-0001', status: 'OK', latencyMs: 100 }),
  makeNode({ nodeId: 'node-0002', status: 'CRITICAL', latencyMs: 900 }),
  makeNode({ nodeId: 'node-0003', status: 'CRITICAL', latencyMs: 850 }),
  makeNode({ nodeId: 'node-0013', status: 'WARNING', latencyMs: 350 }),
];

describe('selectVisibleNodeIds', () => {
  it('lists every node for the default query', () => {
    const ids = selectVisibleNodeIds(nodes, {
      statusFilter: 'ALL',
      search: '',
      sort: { key: 'nodeId', direction: 'asc' },
    });

    expect(ids).toEqual(['node-0001', 'node-0002', 'node-0003', 'node-0013']);
  });

  it('applies the status filter, search and sort together', () => {
    const critical = selectVisibleNodeIds(nodes, {
      statusFilter: 'CRITICAL',
      search: '',
      sort: { key: 'latencyMs', direction: 'desc' },
    });
    const searched = selectVisibleNodeIds(nodes, {
      statusFilter: 'ALL',
      search: '13',
      sort: { key: 'nodeId', direction: 'asc' },
    });

    expect(critical).toEqual(['node-0002', 'node-0003']);
    expect(searched).toEqual(['node-0013']);
  });

  it('returns an empty list when nothing matches', () => {
    const ids = selectVisibleNodeIds(nodes, {
      statusFilter: 'OK',
      search: '0002',
      sort: { key: 'nodeId', direction: 'asc' },
    });

    expect(ids).toEqual([]);
  });
});
