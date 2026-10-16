import type { NodeTelemetry } from '@shared/protocol';

export const TEST_TIMESTAMP = 1_700_000_000_000;

export function makeNode(overrides: Partial<NodeTelemetry> = {}): NodeTelemetry {
  return {
    nodeId: 'node-0001',
    status: 'OK',
    cpuLoad: 40,
    memoryUsage: 50,
    latencyMs: 120,
    timestamp: TEST_TIMESTAMP,
    ...overrides,
  };
}

export function makeNodes(count: number, overrides: Partial<NodeTelemetry> = {}): NodeTelemetry[] {
  return Array.from({ length: count }, (_, index) =>
    makeNode({ nodeId: `node-${String(index + 1).padStart(4, '0')}`, ...overrides }),
  );
}
