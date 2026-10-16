import type { TelemetryState } from './telemetryStore';

import type { StatusCounts } from '@/domain/filters';
import { countByStatus } from '@/domain/filters';
import type { FleetMetrics } from '@/domain/metrics';
import { computeFleetMetrics } from '@/domain/metrics';
import { memoizeLast } from '@/lib/memoizeLast';
import type { NodeTelemetry } from '@shared/protocol';

// Memoized on state identity: one O(n) pass per flush, shared by every subscriber.
const listNodes = memoizeLast((byId: TelemetryState['byId']): readonly NodeTelemetry[] =>
  Object.values(byId),
);
const computeMetrics = memoizeLast(computeFleetMetrics);
const computeCounts = memoizeLast(countByStatus);

export function selectFleetMetrics(state: TelemetryState): FleetMetrics {
  return computeMetrics(listNodes(state.byId), state.serverTime);
}

/** Counts every known node, stale ones included, so each number matches the rows its filter lists. */
export function selectStatusCounts(state: TelemetryState): StatusCounts {
  return computeCounts(listNodes(state.byId));
}
