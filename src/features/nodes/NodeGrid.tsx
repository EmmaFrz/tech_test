import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { KeyboardEvent, ReactElement } from 'react';

import { useHasNodes, useSelectedNodeId, useUiActions, useVisibleNodeIds } from '@/store';
import { EmptyState } from '@/ui';

import { nodeButtonId, resolveNavigationTarget } from './gridNavigation';
import styles from './NodeGrid.module.css';
import { NodeRow } from './NodeRow';

// Only an estimate: rows are measured, so the real height comes from the design tokens.
const ESTIMATED_ROW_HEIGHT_PX = 44;
const OVERSCAN_ROWS = 8;
const HEADER_ROW_COUNT = 1;

const COLUMNS = ['Node', 'Status', 'CPU', 'Memory', 'Latency', 'Updated (UTC)'] as const;

export function NodeGrid(): ReactElement {
  const nodeIds = useVisibleNodeIds();
  const hasNodes = useHasNodes();
  const selectedNodeId = useSelectedNodeId();
  const { selectNode } = useUiActions();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingFocusId = useRef<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual returns unmemoizable functions
  const virtualizer = useVirtualizer({
    count: nodeIds.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT_PX,
    getItemKey: (index) => nodeIds[index] ?? index,
    overscan: OVERSCAN_ROWS,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const renderedIds = virtualItems.flatMap((item) => nodeIds[item.index] ?? []);
  const tabStopId =
    activeNodeId !== null && renderedIds.includes(activeNodeId) ? activeNodeId : renderedIds[0];

  const handleActivate = useCallback((nodeId: string) => setActiveNodeId(nodeId), []);

  useEffect(() => {
    const nodeId = pendingFocusId.current;
    const button = nodeId === null ? null : document.getElementById(nodeButtonId(nodeId));
    if (button !== null) {
      button.focus({ preventScroll: true });
      pendingFocusId.current = null;
    }
  });

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const currentIndex = activeNodeId === null ? -1 : nodeIds.indexOf(activeNodeId);
    const targetIndex = resolveNavigationTarget(event.key, currentIndex, nodeIds.length);
    const targetId = targetIndex === null ? undefined : nodeIds[targetIndex];
    if (targetIndex === null || targetId === undefined) {
      return;
    }

    event.preventDefault();
    pendingFocusId.current = targetId;
    setActiveNodeId(targetId);
    virtualizer.scrollToIndex(targetIndex);
  }

  return (
    <div
      role="grid"
      aria-label="Fleet nodes"
      aria-rowcount={nodeIds.length + HEADER_ROW_COUNT}
      tabIndex={-1}
      className={styles.grid}
      data-testid="node-grid"
      onKeyDown={handleKeyDown}
    >
      <div ref={scrollRef} className={styles.scroller}>
        <div role="row" aria-rowindex={1} className={styles.header}>
          {COLUMNS.map((column) => (
            <div key={column} role="columnheader">
              {column}
            </div>
          ))}
        </div>
        {nodeIds.length === 0 ? (
          <EmptyState
            title={hasNodes ? 'No nodes match' : 'Waiting for telemetry'}
            description={
              hasNodes
                ? 'Adjust the status filter or the search to see more nodes.'
                : 'Nodes appear here as soon as the first snapshot arrives.'
            }
          />
        ) : (
          <div
            role="rowgroup"
            className={styles.canvas}
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualItems.map((item) => {
              const nodeId = nodeIds[item.index];
              return nodeId === undefined ? null : (
                <NodeRow
                  key={nodeId}
                  nodeId={nodeId}
                  index={item.index}
                  offsetTop={item.start}
                  isSelected={nodeId === selectedNodeId}
                  isTabStop={nodeId === tabStopId}
                  onSelect={selectNode}
                  onActivate={handleActivate}
                  measureRef={virtualizer.measureElement}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
