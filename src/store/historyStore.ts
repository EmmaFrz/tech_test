import { RingBuffer } from '@/domain/ringBuffer';
import type { NodeTelemetry } from '@shared/protocol';

export const HISTORY_CAPACITY = 120;

export interface HistorySample {
  readonly timestamp: number;
  readonly cpuLoad: number;
  readonly memoryUsage: number;
  readonly latencyMs: number;
}

export interface HistoryStore {
  readonly record: (updates: readonly NodeTelemetry[]) => void;
  readonly getSamples: (nodeId: string) => readonly HistorySample[];
  readonly subscribe: (nodeId: string, listener: () => void) => () => void;
  readonly clear: () => void;
}

interface NodeHistory {
  readonly buffer: RingBuffer<HistorySample>;
  cachedSamples: readonly HistorySample[] | null;
  lastTimestamp: number;
}

const NO_SAMPLES: readonly HistorySample[] = [];

/**
 * Mutable ring buffers kept outside React: recording a sample never re-renders anything, and
 * only listeners of the touched node are notified.
 */
export function createHistoryStore(capacity: number = HISTORY_CAPACITY): HistoryStore {
  const histories = new Map<string, NodeHistory>();
  const listeners = new Map<string, Set<() => void>>();

  function getOrCreate(nodeId: string): NodeHistory {
    const existing = histories.get(nodeId);
    if (existing !== undefined) {
      return existing;
    }

    const created: NodeHistory = {
      buffer: new RingBuffer<HistorySample>(capacity),
      cachedSamples: null,
      lastTimestamp: Number.NEGATIVE_INFINITY,
    };
    histories.set(nodeId, created);
    return created;
  }

  return {
    record: (updates) => {
      const touched = new Set<string>();
      for (const update of updates) {
        const history = getOrCreate(update.nodeId);
        if (update.timestamp <= history.lastTimestamp) {
          continue;
        }

        history.buffer.push({
          timestamp: update.timestamp,
          cpuLoad: update.cpuLoad,
          memoryUsage: update.memoryUsage,
          latencyMs: update.latencyMs,
        });
        history.lastTimestamp = update.timestamp;
        history.cachedSamples = null;
        touched.add(update.nodeId);
      }

      for (const nodeId of touched) {
        listeners.get(nodeId)?.forEach((listener) => listener());
      }
    },
    getSamples: (nodeId) => {
      const history = histories.get(nodeId);
      if (history === undefined) {
        return NO_SAMPLES;
      }

      history.cachedSamples ??= history.buffer.toArray();
      return history.cachedSamples;
    },
    subscribe: (nodeId, listener) => {
      const nodeListeners = listeners.get(nodeId) ?? new Set<() => void>();
      nodeListeners.add(listener);
      listeners.set(nodeId, nodeListeners);

      return () => {
        nodeListeners.delete(listener);
        if (nodeListeners.size === 0) {
          listeners.delete(nodeId);
        }
      };
    },
    clear: () => {
      const subscribed = [...listeners.keys()];
      histories.clear();
      for (const nodeId of subscribed) {
        listeners.get(nodeId)?.forEach((listener) => listener());
      }
    },
  };
}

export const historyStore = createHistoryStore();
