import type { ReactElement } from 'react';

import { NodeDetailPanel } from '@/features/node-detail';
import { NodeGrid } from '@/features/nodes';
import { useSelectedNodeId, useUiActions } from '@/store';

import { RegionBoundary } from './RegionBoundary';
import styles from './Workspace.module.css';

/** Grid beside the detail panel; below 1280 px the panel becomes a drawer over the grid. */
export function Workspace(): ReactElement {
  const selectedNodeId = useSelectedNodeId();
  const { selectNode } = useUiActions();
  const isOpen = selectedNodeId !== null;

  return (
    <div className={styles.workspace}>
      <RegionBoundary region="the node grid">
        <NodeGrid />
      </RegionBoundary>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close node details"
        className={styles.backdrop}
        data-open={isOpen}
        onClick={() => selectNode(null)}
      />
      <aside aria-label="Node details" className={styles.detail} data-open={isOpen}>
        <RegionBoundary region="the node details">
          <NodeDetailPanel />
        </RegionBoundary>
      </aside>
    </div>
  );
}
