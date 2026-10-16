import type { NodeTelemetry } from '@shared/protocol';

/** Everything received since the previous animation frame, already coalesced per node. */
export interface IngestBatch {
  readonly updates: readonly NodeTelemetry[];
  readonly serverTime: number | null;
  readonly receivedAt: number;
}
