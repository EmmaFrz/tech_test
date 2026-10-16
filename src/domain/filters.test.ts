import { describe, expect, it } from 'vitest';

import { makeNode } from '@/test/factories';

import { countByStatus, matchesSearch, matchesStatusFilter, STATUS_FILTERS } from './filters';

describe('matchesStatusFilter', () => {
  it('matches every node when the filter is ALL', () => {
    expect(matchesStatusFilter(makeNode({ status: 'WARNING' }), 'ALL')).toBe(true);
  });

  it('matches only nodes with the selected status', () => {
    const critical = makeNode({ status: 'CRITICAL' });

    expect(matchesStatusFilter(critical, 'CRITICAL')).toBe(true);
    expect(matchesStatusFilter(critical, 'OK')).toBe(false);
  });
});

describe('matchesSearch', () => {
  const node = makeNode({ nodeId: 'node-0042' });

  it('matches every node for an empty or blank query', () => {
    expect(matchesSearch(node, '')).toBe(true);
    expect(matchesSearch(node, '   ')).toBe(true);
  });

  it('matches a substring of the node ID regardless of case', () => {
    expect(matchesSearch(node, '042')).toBe(true);
    expect(matchesSearch(node, 'NODE-00')).toBe(true);
  });

  it('ignores surrounding whitespace in the query', () => {
    expect(matchesSearch(node, '  0042 ')).toBe(true);
  });

  it('rejects a query that is not part of the node ID', () => {
    expect(matchesSearch(node, '999')).toBe(false);
  });
});

describe('countByStatus', () => {
  it('counts nodes per status and the total', () => {
    const nodes = [
      makeNode({ nodeId: 'a', status: 'OK' }),
      makeNode({ nodeId: 'b', status: 'OK' }),
      makeNode({ nodeId: 'c', status: 'WARNING' }),
      makeNode({ nodeId: 'd', status: 'CRITICAL' }),
    ];

    expect(countByStatus(nodes)).toEqual({ ALL: 4, OK: 2, WARNING: 1, CRITICAL: 1 });
  });

  it('returns zeros for an empty fleet', () => {
    expect(countByStatus([])).toEqual({ ALL: 0, OK: 0, WARNING: 0, CRITICAL: 0 });
  });
});

describe('STATUS_FILTERS', () => {
  it('lists ALL first, then statuses from least to most severe', () => {
    expect(STATUS_FILTERS).toEqual(['ALL', 'OK', 'WARNING', 'CRITICAL']);
  });
});
