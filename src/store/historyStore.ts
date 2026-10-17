import { RingBuffer } from '@/domain/ringBuffer';
import type { NodeTelemetry } from '@shared/protocol';

export const HISTORY_CAPACITY = 120;

export interface HistorySample {
  readonly timestamp: number;
  readonly cpuLoad: number;
  readonly memoryUsage: number;
  readonly latencyMs: number;
}

/** A snapshot lists the whole fleet; an update lists only the nodes that reported. */
export type HistoryBatchKind = 'snapshot' | 'update';

export interface HistoryStore {
  /**
   * Appends one sample per node, skipping samples that are not newer than the node's latest one.
   * A snapshot also reconciles the fleet: it drops the history of every node it no longer lists
   * and restarts a history whose clock it moves backwards, which means a different server session.
   * Histories that a snapshot continues (an ordinary reconnect) are kept.
   */
  readonly record: (samples: readonly NodeTelemetry[], kind?: HistoryBatchKind) => void;
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

  function createHistory(nodeId: string): NodeHistory {
    const created: NodeHistory = {
      buffer: new RingBuffer<HistorySample>(capacity),
      cachedSamples: null,
      lastTimestamp: Number.NEGATIVE_INFINITY,
    };
    histories.set(nodeId, created);
    return created;
  }

  function historyFor(sample: NodeTelemetry, kind: HistoryBatchKind): NodeHistory {
    const existing = histories.get(sample.nodeId);
    if (existing === undefined) {
      return createHistory(sample.nodeId);
    }

    return kind === 'snapshot' && sample.timestamp < existing.lastTimestamp
      ? createHistory(sample.nodeId)
      : existing;
  }

  function notify(nodeIds: Iterable<string>): void {
    for (const nodeId of nodeIds) {
      listeners.get(nodeId)?.forEach((listener) => listener());
    }
  }

  return {
    record: (samples, kind = 'update') => {
      const touched = new Set<string>();
      if (kind === 'snapshot') {
        const listed = new Set(samples.map((sample) => sample.nodeId));
        for (const nodeId of histories.keys()) {
          if (!listed.has(nodeId)) {
            histories.delete(nodeId);
            touched.add(nodeId);
          }
        }
      }

      for (const sample of samples) {
        const history = historyFor(sample, kind);
        if (sample.timestamp <= history.lastTimestamp) {
          continue;
        }

        history.buffer.push({
          timestamp: sample.timestamp,
          cpuLoad: sample.cpuLoad,
          memoryUsage: sample.memoryUsage,
          latencyMs: sample.latencyMs,
        });
        history.lastTimestamp = sample.timestamp;
        history.cachedSamples = null;
        touched.add(sample.nodeId);
      }

      notify(touched);
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
      notify(subscribed);
    },
  };
}

export const historyStore = createHistoryStore();
