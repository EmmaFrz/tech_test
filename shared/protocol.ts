export type NodeStatus = 'OK' | 'WARNING' | 'CRITICAL';

export interface NodeTelemetry {
  readonly nodeId: string;
  readonly status: NodeStatus;
  readonly cpuLoad: number;
  readonly memoryUsage: number;
  readonly latencyMs: number;
  readonly timestamp: number;
}

export type ServerMessage =
  | { readonly type: 'snapshot'; readonly seq: number; readonly nodes: readonly NodeTelemetry[] }
  | { readonly type: 'delta'; readonly seq: number; readonly updates: readonly NodeTelemetry[] }
  | { readonly type: 'heartbeat'; readonly seq: number; readonly serverTime: number };
