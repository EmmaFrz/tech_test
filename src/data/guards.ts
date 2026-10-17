import { isNodeStatus } from '@/domain/status';
import type { NodeTelemetry, ServerMessage } from '@shared/protocol';

export class TelemetryParseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'TelemetryParseError';
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPercentage(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100;
}

// Past year 9999 dates format with six-digit years, and an absurd server time would mark every
// node stale until the next snapshot; both must be stopped here, before they reach the store.
const MAX_EPOCH_MS = Date.UTC(9999, 11, 31, 23, 59, 59, 999);

/** Epoch milliseconds from 1970 to the end of year 9999, the range the UI can format. */
function isEpochMilliseconds(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= MAX_EPOCH_MS;
}

// A round trip slower than an hour is a broken probe. Finite values near Number.MAX_VALUE would
// overflow the fleet average and the chart axis; an hour keeps any fleet's latency sum exact.
const MAX_LATENCY_MS = 3_600_000;

function isLatencyMs(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= MAX_LATENCY_MS;
}

export function isNodeTelemetry(value: unknown): value is NodeTelemetry {
  return (
    isRecord(value) &&
    typeof value['nodeId'] === 'string' &&
    value['nodeId'] !== '' &&
    isNodeStatus(value['status']) &&
    isPercentage(value['cpuLoad']) &&
    isPercentage(value['memoryUsage']) &&
    isLatencyMs(value['latencyMs']) &&
    isEpochMilliseconds(value['timestamp'])
  );
}

function isNodeTelemetryList(value: unknown): value is readonly NodeTelemetry[] {
  return Array.isArray(value) && value.every(isNodeTelemetry);
}

export function isServerMessage(value: unknown): value is ServerMessage {
  if (!isRecord(value) || !Number.isSafeInteger(value['seq'])) {
    return false;
  }

  switch (value['type']) {
    case 'snapshot':
      return isNodeTelemetryList(value['nodes']);
    case 'delta':
      return isNodeTelemetryList(value['updates']);
    case 'heartbeat':
      return isEpochMilliseconds(value['serverTime']);
    default:
      return false;
  }
}

/** Decodes one WebSocket payload; throws `TelemetryParseError` so the caller can drop and count it. */
export function decodeServerMessage(raw: unknown): ServerMessage {
  if (typeof raw !== 'string') {
    throw new TelemetryParseError('payload is not text');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new TelemetryParseError('payload is not valid JSON', { cause: error });
  }

  if (!isServerMessage(parsed)) {
    throw new TelemetryParseError('payload does not match the protocol');
  }

  return parsed;
}
