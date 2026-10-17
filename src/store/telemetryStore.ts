import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { HistoryStore } from './historyStore';
import type { StoreApi, UseBoundStore } from 'zustand';

import type { ConnectionState } from '@/domain/connection';
import type { CriticalEntries } from '@/domain/criticalEntries';
import { trackCriticalEntries } from '@/domain/criticalEntries';
import type { IngestBatch } from '@/domain/ingest';
import { createDictionary } from '@/lib/dictionary';
import { IS_DEVELOPMENT } from '@/lib/env';
import type { NodeTelemetry } from '@shared/protocol';

import { historyStore } from './historyStore';

export interface TelemetryActions {
  readonly applySnapshot: (nodes: readonly NodeTelemetry[], receivedAt: number) => void;
  readonly applyBatch: (batch: IngestBatch) => void;
  readonly setConnection: (connection: ConnectionState) => void;
  readonly pause: () => void;
  readonly resume: () => void;
}

export interface TelemetryState {
  /** Prototype-free, so every node ID the protocol accepts is an ordinary key. */
  readonly byId: Readonly<Record<string, NodeTelemetry>>;
  /** Browser time each shown node entered CRITICAL, kept while its pulse may still play. */
  readonly criticalSince: CriticalEntries;
  /** Increments whenever a snapshot replaces the node set. */
  readonly epoch: number;
  readonly connection: ConnectionState;
  /** Browser clock time of the latest flush, used for the "updated Xs ago" indicator. */
  readonly lastMessageAt: number | null;
  /** Newest server clock value seen; the reference point for staleness. */
  readonly serverTime: number | null;
  readonly paused: boolean;
  readonly actions: TelemetryActions;
}

function latestOf(current: number | null, candidates: readonly (number | null)[]): number | null {
  let latest = current;
  for (const candidate of candidates) {
    if (candidate !== null && (latest === null || candidate > latest)) {
      latest = candidate;
    }
  }
  return latest;
}

function indexNodes(nodes: readonly NodeTelemetry[]): TelemetryState['byId'] {
  const byId = createDictionary<NodeTelemetry>();
  for (const node of nodes) {
    byId[node.nodeId] = node;
  }
  return byId;
}

function mergeUpdates(
  byId: TelemetryState['byId'],
  updates: readonly NodeTelemetry[],
): TelemetryState['byId'] {
  if (updates.length === 0) {
    return byId;
  }

  // Only the updated entries get new references, so rows of untouched nodes do not re-render.
  const next = createDictionary(byId);
  for (const update of updates) {
    next[update.nodeId] = update;
  }
  return next;
}

export type TelemetryStore = UseBoundStore<StoreApi<TelemetryState>>;

export function createTelemetryStore(
  history: Pick<HistoryStore, 'record'> = historyStore,
): TelemetryStore {
  return create<TelemetryState>()(
    devtools(
      (set, get) => {
        // Not React state: nothing renders the buffered updates while the view is paused.
        const buffered = new Map<string, NodeTelemetry>();
        let bufferedServerTime: number | null = null;

        function apply(updates: readonly NodeTelemetry[], serverTime: number | null, at: number) {
          const state = get();
          const byId = mergeUpdates(state.byId, updates);
          return {
            byId,
            criticalSince: trackCriticalEntries(state.criticalSince, {
              previous: state.byId,
              next: byId,
              changed: updates,
              at,
            }),
            serverTime: latestOf(state.serverTime, [
              serverTime,
              ...updates.map((u) => u.timestamp),
            ]),
          };
        }

        return {
          byId: createDictionary<NodeTelemetry>(),
          criticalSince: createDictionary<number>(),
          epoch: 0,
          // The server-rendered shell must not claim the link is lost before a connection is tried.
          connection: 'connecting',
          lastMessageAt: null,
          serverTime: null,
          paused: false,
          actions: {
            applySnapshot: (nodes, receivedAt) => {
              buffered.clear();
              bufferedServerTime = null;
              const state = get();
              const byId = indexNodes(nodes);
              set(
                {
                  byId,
                  criticalSince: trackCriticalEntries(state.criticalSince, {
                    previous: state.byId,
                    next: byId,
                    changed: nodes,
                    at: receivedAt,
                  }),
                  serverTime: latestOf(
                    null,
                    nodes.map((node) => node.timestamp),
                  ),
                  epoch: state.epoch + 1,
                  lastMessageAt: receivedAt,
                },
                false,
                'applySnapshot',
              );
              history.record(nodes, 'snapshot');
            },
            applyBatch: (batch) => {
              const state = get();
              if (state.paused) {
                for (const update of batch.updates) {
                  buffered.set(update.nodeId, update);
                }
                bufferedServerTime = latestOf(bufferedServerTime, [batch.serverTime]);
                set(
                  {
                    lastMessageAt: batch.receivedAt,
                    criticalSince: trackCriticalEntries(state.criticalSince, {
                      previous: state.byId,
                      next: state.byId,
                      changed: [],
                      at: batch.receivedAt,
                    }),
                  },
                  false,
                  'applyBatch/buffered',
                );
                return;
              }

              set(
                {
                  ...apply(batch.updates, batch.serverTime, batch.receivedAt),
                  lastMessageAt: batch.receivedAt,
                },
                false,
                'applyBatch',
              );
              history.record(batch.updates);
            },
            setConnection: (connection) => set({ connection }, false, 'setConnection'),
            pause: () => set({ paused: true }, false, 'pause'),
            resume: () => {
              const updates = [...buffered.values()];
              const serverTime = bufferedServerTime;
              buffered.clear();
              bufferedServerTime = null;
              // The latest flush time is the store's clock; it keeps moving while paused.
              const at = get().lastMessageAt ?? 0;
              set({ ...apply(updates, serverTime, at), paused: false }, false, 'resume');
              history.record(updates);
            },
          },
        };
      },
      { name: 'telemetryStore', enabled: IS_DEVELOPMENT },
    ),
  );
}

export const useTelemetryStore = createTelemetryStore();
