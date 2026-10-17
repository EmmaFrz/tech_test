import { assertNever } from '@/lib/assertNever';
import type { NodeTelemetry } from '@shared/protocol';

import { STATUS_SEVERITY } from './status';

export const SORT_KEYS = ['status', 'latencyMs', 'cpuLoad', 'memoryUsage', 'nodeId'] as const;

export type SortKey = (typeof SORT_KEYS)[number];

export type SortDirection = 'asc' | 'desc';

export interface SortSpec {
  readonly key: SortKey;
  readonly direction: SortDirection;
}

/** Most severe first, which is what an operator triaging the fleet wants on top. */
export const DEFAULT_SORT: SortSpec = { key: 'status', direction: 'desc' };

const NODE_ID_COLLATOR = new Intl.Collator('en', { numeric: true });

function compareNodeIds(left: NodeTelemetry, right: NodeTelemetry): number {
  return NODE_ID_COLLATOR.compare(left.nodeId, right.nodeId);
}

function comparePrimary(key: SortKey, left: NodeTelemetry, right: NodeTelemetry): number {
  switch (key) {
    case 'nodeId':
      return compareNodeIds(left, right);
    case 'status':
      return STATUS_SEVERITY[left.status] - STATUS_SEVERITY[right.status];
    case 'latencyMs':
      return left.latencyMs - right.latencyMs;
    case 'cpuLoad':
      return left.cpuLoad - right.cpuLoad;
    case 'memoryUsage':
      return left.memoryUsage - right.memoryUsage;
    default:
      return assertNever(key);
  }
}

/** Ties always fall back to ascending node ID so equal rows never swap places between sorts. */
export function compareNodes(
  sort: SortSpec,
): (left: NodeTelemetry, right: NodeTelemetry) => number {
  const direction = sort.direction === 'asc' ? 1 : -1;
  return (left, right) =>
    direction * comparePrimary(sort.key, left, right) || compareNodeIds(left, right);
}

function primaryValue(key: SortKey, node: NodeTelemetry, idRank: number): number {
  switch (key) {
    case 'nodeId':
      return idRank;
    case 'status':
      return STATUS_SEVERITY[node.status];
    case 'latencyMs':
      return node.latencyMs;
    case 'cpuLoad':
      return node.cpuLoad;
    case 'memoryUsage':
      return node.memoryUsage;
    default:
      return assertNever(key);
  }
}

// Collating IDs dominated sorts with many ties (most nodes share a status or a latency), so the
// IDs are ranked once and the ranking is reused until IDs it has not seen show up.
let rankedIds: ReadonlyMap<string, number> = new Map();

/**
 * IDs the collator considers equal (`node-01` and `node-1`, composed and decomposed accents) share
 * a rank, so they tie as in `compareNodes` and keep their input order.
 */
function rankNodeIds(nodes: readonly NodeTelemetry[]): ReadonlyMap<string, number> {
  if (nodes.every((node) => rankedIds.has(node.nodeId))) {
    return rankedIds;
  }

  const ids = nodes
    .map((node) => node.nodeId)
    .sort((left, right) => NODE_ID_COLLATOR.compare(left, right));
  const ranks = new Map<string, number>();
  let rank = 0;
  ids.forEach((id, index) => {
    const previous = ids[index - 1];
    if (previous !== undefined && NODE_ID_COLLATOR.compare(previous, id) !== 0) {
      rank += 1;
    }
    ranks.set(id, rank);
  });
  rankedIds = ranks;
  return rankedIds;
}

/** Same order as `compareNodes`, but it compares precomputed numbers instead of collating IDs. */
export function sortNodes(nodes: readonly NodeTelemetry[], sort: SortSpec): NodeTelemetry[] {
  const ranks = rankNodeIds(nodes);
  const direction = sort.direction === 'asc' ? 1 : -1;
  return nodes
    .map((node) => {
      const rank = ranks.get(node.nodeId) ?? 0;
      return { node, rank, value: primaryValue(sort.key, node, rank) };
    })
    .sort((left, right) => direction * (left.value - right.value) || left.rank - right.rank)
    .map((entry) => entry.node);
}
