import type { NodeStatus } from '@shared/protocol';

export const NODE_STATUSES: readonly NodeStatus[] = ['OK', 'WARNING', 'CRITICAL'];

export const STATUS_SEVERITY: Readonly<Record<NodeStatus, number>> = {
  OK: 0,
  WARNING: 1,
  CRITICAL: 2,
};

export function isNodeStatus(value: unknown): value is NodeStatus {
  return NODE_STATUSES.some((status) => status === value);
}
