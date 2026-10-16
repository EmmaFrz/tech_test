import type { NodeTelemetry } from '@shared/protocol';

export const STALE_AFTER_MS = 10_000;

export interface FleetMetrics {
  readonly totalNodes: number;
  readonly activeNodes: number;
  readonly staleNodes: number;
  readonly criticalCount: number;
  readonly warningCount: number;
  readonly averageLatencyMs: number | null;
}

/** Staleness is measured on the server clock, so a skewed browser clock cannot mark nodes stale. */
export function isNodeStale(node: NodeTelemetry, serverTime: number | null): boolean {
  return serverTime !== null && serverTime - node.timestamp > STALE_AFTER_MS;
}

/** Stale nodes are excluded from every figure except `totalNodes` and `staleNodes`. */
export function computeFleetMetrics(
  nodes: readonly NodeTelemetry[],
  serverTime: number | null,
): FleetMetrics {
  let activeNodes = 0;
  let criticalCount = 0;
  let warningCount = 0;
  let latencySum = 0;

  for (const node of nodes) {
    if (isNodeStale(node, serverTime)) {
      continue;
    }

    activeNodes += 1;
    latencySum += node.latencyMs;
    if (node.status === 'CRITICAL') {
      criticalCount += 1;
    } else if (node.status === 'WARNING') {
      warningCount += 1;
    }
  }

  return {
    totalNodes: nodes.length,
    activeNodes,
    staleNodes: nodes.length - activeNodes,
    criticalCount,
    warningCount,
    averageLatencyMs: activeNodes === 0 ? null : latencySum / activeNodes,
  };
}
