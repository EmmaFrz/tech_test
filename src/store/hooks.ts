import { useEffect, useState, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { HistorySample } from './historyStore';
import type { TelemetryActions } from './telemetryStore';
import type { UiActions } from './uiStore';

import type { ConnectionState } from '@/domain/connection';
import type { StatusCounts, StatusFilter } from '@/domain/filters';
import type { FleetMetrics } from '@/domain/metrics';
import { isNodeStale } from '@/domain/metrics';
import type { SortSpec } from '@/domain/sorters';
import type { NodeTelemetry } from '@shared/protocol';

import { historyStore } from './historyStore';
import { selectFleetMetrics, selectStatusCounts } from './selectors';
import { useTelemetryStore } from './telemetryStore';
import { useUiStore } from './uiStore';
import { useVisibleNodesStore } from './visibleNodes';

const NO_SAMPLES: readonly HistorySample[] = [];

function subscribeToNothing(): () => void {
  return () => undefined;
}

export function useNodeById(nodeId: string): NodeTelemetry | undefined {
  return useTelemetryStore((state) => state.byId[nodeId]);
}

export function useIsNodeStale(nodeId: string): boolean {
  return useTelemetryStore((state) => {
    const node = state.byId[nodeId];
    return node !== undefined && isNodeStale(node, state.serverTime);
  });
}

/** Browser time the node entered CRITICAL while that entry is recent enough to pulse. */
export function useCriticalSince(nodeId: string): number | undefined {
  return useTelemetryStore((state) => state.criticalSince[nodeId]);
}

export function useFleetMetrics(): FleetMetrics {
  return useTelemetryStore(useShallow(selectFleetMetrics));
}

export function useStatusCounts(): StatusCounts {
  return useTelemetryStore(useShallow(selectStatusCounts));
}

/** True once a snapshot has arrived, i.e. the fleet is known. */
export function useHasNodes(): boolean {
  return useTelemetryStore((state) => state.epoch > 0);
}

export function useCriticalCount(): number {
  return useTelemetryStore((state) => selectFleetMetrics(state).criticalCount);
}

export function useConnectionState(): ConnectionState {
  return useTelemetryStore((state) => state.connection);
}

export function useIsPaused(): boolean {
  return useTelemetryStore((state) => state.paused);
}

export function useTelemetryActions(): TelemetryActions {
  return useTelemetryStore((state) => state.actions);
}

/** Milliseconds since the latest flush, re-evaluated every `refreshMs`; null before any data. */
export function useMillisecondsSinceLastMessage(refreshMs: number): number | null {
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  useEffect(() => {
    function refresh(): void {
      const { lastMessageAt } = useTelemetryStore.getState();
      setElapsedMs(lastMessageAt === null ? null : Math.max(0, Date.now() - lastMessageAt));
    }

    refresh();
    const timer = setInterval(refresh, refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs]);

  return elapsedMs;
}

/**
 * Not deferred: a reorder must land in the same commit as the flush that caused it. The grid
 * mounts only its visible window, and the search box already writes a deferred value.
 */
export function useVisibleNodeIds(): readonly string[] {
  return useVisibleNodesStore((state) => state.ids);
}

export function useIsNodeVisible(nodeId: string): boolean {
  return useVisibleNodesStore((state) => state.ids.includes(nodeId));
}

export function useNodeHistory(nodeId: string | null): readonly HistorySample[] {
  return useSyncExternalStore(
    nodeId === null ? subscribeToNothing : (listener) => historyStore.subscribe(nodeId, listener),
    () => (nodeId === null ? NO_SAMPLES : historyStore.getSamples(nodeId)),
  );
}

export function useStatusFilter(): StatusFilter {
  return useUiStore((state) => state.statusFilter);
}

export function useSort(): SortSpec {
  return useUiStore((state) => state.sort);
}

export function useSearch(): string {
  return useUiStore((state) => state.search);
}

export function useSelectedNodeId(): string | null {
  return useUiStore((state) => state.selectedNodeId);
}

export function useUiActions(): UiActions {
  return useUiStore((state) => state.actions);
}
