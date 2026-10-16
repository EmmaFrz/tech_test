import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { TelemetryState } from './telemetryStore';
import type { UiState } from './uiStore';
import type { StoreApi, UseBoundStore } from 'zustand';

import { selectVisibleNodeIds } from '@/domain/visibleNodes';
import { IS_DEVELOPMENT } from '@/lib/env';

import { useTelemetryStore } from './telemetryStore';
import { useUiStore } from './uiStore';

// Reordering rows on every tick is unreadable under load; values still update live per row.
export const ORDER_REFRESH_MS = 1_000;

export interface VisibleNodesState {
  readonly ids: readonly string[];
}

export type VisibleNodesStore = UseBoundStore<StoreApi<VisibleNodesState>>;

export function createVisibleNodesStore(): VisibleNodesStore {
  return create<VisibleNodesState>()(
    devtools(() => ({ ids: [] }), { name: 'visibleNodesStore', enabled: IS_DEVELOPMENT }),
  );
}

export const useVisibleNodesStore = createVisibleNodesStore();

export interface VisibleNodesSyncOptions {
  readonly telemetry?: StoreApi<TelemetryState>;
  readonly ui?: StoreApi<UiState>;
  readonly target?: StoreApi<VisibleNodesState>;
  readonly now?: () => number;
  /**
   * Runs an order refresh that falls due between telemetry flushes. The telemetry wiring passes
   * its frame scheduler, so the refresh shares the next flush's commit; by default it runs at once.
   */
  readonly runRefresh?: (refresh: () => void) => void;
}

function runImmediately(refresh: () => void): void {
  refresh();
}

function haveSameItems(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

/**
 * Keeps the visible node list in sync outside React. Filter, sort, search and pause changes
 * recompute immediately, and so does a new snapshot; deltas recompute at most once per
 * `ORDER_REFRESH_MS`.
 * Returns a function that stops the synchronization.
 */
export function startVisibleNodesSync(options: VisibleNodesSyncOptions = {}): () => void {
  const telemetry = options.telemetry ?? useTelemetryStore;
  const ui = options.ui ?? useUiStore;
  const target = options.target ?? useVisibleNodesStore;
  const now = options.now ?? Date.now;
  const runRefresh = options.runRefresh ?? runImmediately;
  let lastComputedAt = Number.NEGATIVE_INFINITY;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let isRefreshDue = false;

  function clearRefreshTimer(): void {
    isRefreshDue = false;
    if (refreshTimer !== null) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  }

  function recompute(): void {
    clearRefreshTimer();
    lastComputedAt = now();
    const { statusFilter, search, sort } = ui.getState();
    const ids = selectVisibleNodeIds(Object.values(telemetry.getState().byId), {
      statusFilter,
      search,
      sort,
    });
    if (!haveSameItems(target.getState().ids, ids)) {
      target.setState({ ids }, false);
    }
  }

  function refreshIfDue(): void {
    if (isRefreshDue) {
      recompute();
    }
  }

  function scheduleRecompute(): void {
    const elapsedMs = now() - lastComputedAt;
    if (elapsedMs >= ORDER_REFRESH_MS) {
      recompute();
      return;
    }

    refreshTimer ??= setTimeout(() => {
      refreshTimer = null;
      isRefreshDue = true;
      runRefresh(refreshIfDue);
    }, ORDER_REFRESH_MS - elapsedMs);
  }

  const stopTelemetry = telemetry.subscribe((state, previous) => {
    if (state.paused !== previous.paused || state.epoch !== previous.epoch) {
      recompute();
    } else if (state.byId !== previous.byId) {
      scheduleRecompute();
    }
  });
  const stopUi = ui.subscribe((state, previous) => {
    if (
      state.statusFilter !== previous.statusFilter ||
      state.search !== previous.search ||
      state.sort !== previous.sort
    ) {
      recompute();
    }
  });
  recompute();

  return () => {
    stopTelemetry();
    stopUi();
    clearRefreshTimer();
  };
}
