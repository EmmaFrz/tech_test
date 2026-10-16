import type { NodeStatus } from '@shared/protocol.js';

export interface NodeMetrics {
  readonly cpuLoad: number;
  readonly memoryUsage: number;
  readonly latencyMs: number;
}

const CRITICAL_THRESHOLDS: NodeMetrics = { cpuLoad: 90, memoryUsage: 92, latencyMs: 800 };
const WARNING_THRESHOLDS: NodeMetrics = { cpuLoad: 75, memoryUsage: 80, latencyMs: 300 };

function reaches(metrics: NodeMetrics, thresholds: NodeMetrics): boolean {
  return (
    metrics.cpuLoad >= thresholds.cpuLoad ||
    metrics.memoryUsage >= thresholds.memoryUsage ||
    metrics.latencyMs >= thresholds.latencyMs
  );
}

export function deriveStatus(metrics: NodeMetrics): NodeStatus {
  if (reaches(metrics, CRITICAL_THRESHOLDS)) {
    return 'CRITICAL';
  }

  if (reaches(metrics, WARNING_THRESHOLDS)) {
    return 'WARNING';
  }

  return 'OK';
}
