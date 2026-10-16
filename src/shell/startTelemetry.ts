import { BatchScheduler } from '@/data/BatchScheduler';
import type { BatchSchedulerOptions } from '@/data/BatchScheduler';
import type { TelemetrySocket } from '@/data/socket';
import { TelemetryClient } from '@/data/TelemetryClient';
import { resolveTelemetryUrl } from '@/lib/env';
import { startVisibleNodesSync, useTelemetryStore } from '@/store';

export interface StartTelemetryOptions {
  readonly createSocket?: (url: string) => TelemetrySocket;
  readonly requestFrame?: BatchSchedulerOptions['requestFrame'];
  readonly cancelFrame?: BatchSchedulerOptions['cancelFrame'];
}

/** Connects the transport to the stores. Returns a function that tears everything down. */
export function startTelemetry(options: StartTelemetryOptions = {}): () => void {
  const { actions } = useTelemetryStore.getState();
  const scheduler = new BatchScheduler({
    onFlush: actions.applyBatch,
    requestFrame: options.requestFrame,
    cancelFrame: options.cancelFrame,
  });
  const client = new TelemetryClient({
    url: resolveTelemetryUrl(window.location),
    createSocket: options.createSocket,
    onSnapshot: (nodes) => {
      scheduler.clear();
      actions.applySnapshot(nodes, Date.now());
    },
    onDelta: (updates) => scheduler.enqueueUpdates(updates),
    onHeartbeat: (serverTime) => scheduler.enqueueHeartbeat(serverTime),
    onStateChange: actions.setConnection,
  });
  const stopVisibleNodesSync = startVisibleNodesSync();

  client.connect();

  return () => {
    client.disconnect();
    scheduler.dispose();
    stopVisibleNodesSync();
  };
}
