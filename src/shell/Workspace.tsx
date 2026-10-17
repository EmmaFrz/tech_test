import { useEffect, useRef } from 'react';

import type { ReactElement } from 'react';

import { NodeDetailPanel } from '@/features/node-detail';
import { NodeGrid } from '@/features/nodes';
import type { NodeGridHandle } from '@/features/nodes';
import { useSelectedNodeId, useUiActions } from '@/store';

import { CoveredByDrawer } from './CoveredByDrawer';
import { RegionBoundary } from './RegionBoundary';
import { useIsDetailDrawerOpen } from './useIsDetailDrawerOpen';
import styles from './Workspace.module.css';

function isFocusLostOrWithin(...elements: readonly (Element | null)[]): boolean {
  const active = document.activeElement;
  if (active === null || active === document.body) {
    return true;
  }

  return elements.some((element) => element?.contains(active) === true);
}

/** Grid beside the detail panel; below 1280 px the panel becomes a drawer over the grid. */
export function Workspace(): ReactElement {
  const selectedNodeId = useSelectedNodeId();
  const { selectNode } = useUiActions();
  const isDrawerOpen = useIsDetailDrawerOpen();
  const isOpen = selectedNodeId !== null;
  const gridRef = useRef<NodeGridHandle>(null);
  const detailRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const openedForRef = useRef<string | null>(null);

  // The drawer covers the grid that had focus, so focus moves into the drawer. When the page
  // scrolls (narrow window, large text) the drawer's top can sit above the window: show it.
  useEffect(() => {
    const panel = panelRef.current;
    if (isDrawerOpen && panel !== null) {
      panel.focus({ preventScroll: true });
      if (panel.getBoundingClientRect().top < 0) {
        panel.scrollIntoView({ block: 'start' });
      }
    }
  }, [isDrawerOpen]);

  // Closing returns focus to the row the panel showed, unless the user already moved elsewhere.
  useEffect(() => {
    if (selectedNodeId !== null) {
      openedForRef.current = selectedNodeId;
      return;
    }

    const nodeId = openedForRef.current;
    openedForRef.current = null;
    if (nodeId !== null && isFocusLostOrWithin(detailRef.current, backdropRef.current)) {
      gridRef.current?.focusNode(nodeId);
    }
  }, [selectedNodeId]);

  return (
    <div className={styles.workspace}>
      <CoveredByDrawer>
        <RegionBoundary region="the node grid">
          <NodeGrid ref={gridRef} />
        </RegionBoundary>
      </CoveredByDrawer>
      <button
        ref={backdropRef}
        type="button"
        tabIndex={-1}
        aria-label="Close node details"
        className={styles.backdrop}
        data-open={isOpen}
        onClick={() => selectNode(null)}
      />
      <aside ref={detailRef} aria-label="Node details" className={styles.detail} data-open={isOpen}>
        <RegionBoundary region="the node details">
          <NodeDetailPanel ref={panelRef} />
        </RegionBoundary>
      </aside>
    </div>
  );
}
