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

export function sortNodes(nodes: readonly NodeTelemetry[], sort: SortSpec): NodeTelemetry[] {
  return [...nodes].sort(compareNodes(sort));
}
