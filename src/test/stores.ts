import { act } from '@testing-library/react';

import { historyStore, startVisibleNodesSync, useTelemetryStore, useUiStore } from '@/store';
import { useVisibleNodesStore } from '@/store';
import type { NodeTelemetry } from '@shared/protocol';

export function resetStores(): void {
  useTelemetryStore.setState(useTelemetryStore.getInitialState(), true);
  useUiStore.setState(useUiStore.getInitialState(), true);
  useVisibleNodesStore.setState(useVisibleNodesStore.getInitialState(), true);
  historyStore.clear();
}

/** Loads a snapshot as the server would on connect and marks the connection live. */
export function seedFleet(nodes: readonly NodeTelemetry[]): void {
  act(() => {
    const { actions } = useTelemetryStore.getState();
    actions.setConnection('live');
    actions.applySnapshot(nodes, Date.now());
  });
}

/** Keeps the derived visible-node list up to date for the duration of a test. */
export function startVisibleNodes(): () => void {
  let stop: () => void = () => undefined;
  act(() => {
    stop = startVisibleNodesSync();
  });
  return stop;
}
