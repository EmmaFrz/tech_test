const TELEMETRY_PATH = '/ws';

/** Same-origin WebSocket URL, so the build needs no knowledge of the backend host. */
export function resolveTelemetryUrl(location: Pick<Location, 'protocol' | 'host'>): string {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${location.host}${TELEMETRY_PATH}`;
}

export const IS_DEVELOPMENT: boolean = process.env.NODE_ENV !== 'production';
