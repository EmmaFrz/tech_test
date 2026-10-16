import { useSyncExternalStore } from 'react';

import { useSelectedNodeId } from '@/store';

// Mirrors the breakpoint in Workspace.module.css below which the detail panel is a drawer.
const DRAWER_LAYOUT_QUERY = '(max-width: 1279px)';

function subscribeToLayout(onChange: () => void): () => void {
  const query = window.matchMedia(DRAWER_LAYOUT_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function isDrawerLayout(): boolean {
  return window.matchMedia(DRAWER_LAYOUT_QUERY).matches;
}

/** True while the detail panel is open as a drawer over the grid, which happens on narrow screens. */
export function useIsDetailDrawerOpen(): boolean {
  const isNarrow = useSyncExternalStore(subscribeToLayout, isDrawerLayout);
  return useSelectedNodeId() !== null && isNarrow;
}
