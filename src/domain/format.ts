const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60_000;
const SHORT_ELAPSED_LIMIT_MS = 10_000;

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatWholePercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatLatency(latencyMs: number): string {
  return `${Math.round(latencyMs)} ms`;
}

export function formatAverageLatency(latencyMs: number | null): string {
  return latencyMs === null ? '—' : formatLatency(latencyMs);
}

/** Sub-ten-second durations keep one decimal so a live stream visibly ticks. */
export function formatElapsed(elapsedMs: number): string {
  if (elapsedMs < SHORT_ELAPSED_LIMIT_MS) {
    return `${(elapsedMs / MS_PER_SECOND).toFixed(1)}s`;
  }

  if (elapsedMs < MS_PER_MINUTE) {
    return `${Math.floor(elapsedMs / MS_PER_SECOND)}s`;
  }

  return `${Math.floor(elapsedMs / MS_PER_MINUTE)}m`;
}

/** UTC keeps the output independent of the viewer's time zone. */
export function formatUtcTime(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(11, 19);
}

export function formatDocumentTitle(criticalCount: number): string {
  return criticalCount > 0 ? `(${criticalCount}) Fleet Ops` : 'Fleet Ops';
}
