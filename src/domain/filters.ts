import type { NodeStatus, NodeTelemetry } from '@shared/protocol';

import { NODE_STATUSES } from './status';

export type StatusFilter = 'ALL' | NodeStatus;

export const STATUS_FILTERS: readonly StatusFilter[] = ['ALL', ...NODE_STATUSES];

export type StatusCounts = Readonly<Record<StatusFilter, number>>;

export function matchesStatusFilter(node: NodeTelemetry, filter: StatusFilter): boolean {
  return filter === 'ALL' || node.status === filter;
}

export function normalizeSearch(search: string): string {
  return search.trim().toLowerCase();
}

/** Case-insensitive substring match on the node ID; an empty query matches every node. */
export function matchesSearch(node: NodeTelemetry, search: string): boolean {
  const query = normalizeSearch(search);
  return query === '' || node.nodeId.toLowerCase().includes(query);
}

export function countByStatus(nodes: readonly NodeTelemetry[]): StatusCounts {
  const counts = { ALL: nodes.length, OK: 0, WARNING: 0, CRITICAL: 0 };
  for (const node of nodes) {
    counts[node.status] += 1;
  }
  return counts;
}
