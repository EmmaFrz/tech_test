import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import type { FocusEvent, KeyboardEvent, ReactElement, Ref } from 'react';

import { useHasNodes, useSelectedNodeId, useUiActions, useVisibleNodeIds } from '@/store';
import { EmptyState } from '@/ui';

import { nodeButtonId, resolveNavigationTarget, resolveTargetFromGap } from './gridNavigation';
import styles from './NodeGrid.module.css';
import { NodeRow } from './NodeRow';

// Only the first estimate: the real row height comes from the design tokens and is observed.
const ESTIMATED_ROW_HEIGHT_PX = 44;
// Rows kept beyond each edge of the viewport. Every reorder or filter change mounts them too.
const OVERSCAN_ROWS = 4;
const HEADER_ROW_COUNT = 1;

const COLUMNS = ['Node', 'Status', 'CPU', 'Memory', 'Latency', 'Updated (UTC)'] as const;

export interface NodeGridHandle {
  /** Focuses the row of `nodeId`, scrolling it into view, or the grid when it is not listed. */
  readonly focusNode: (nodeId: string) => void;
}

export interface NodeGridProps {
  readonly ref?: Ref<NodeGridHandle>;
}

function isFocusLost(): boolean {
  return document.activeElement === null || document.activeElement === document.body;
}

// The page scrolls when the controls leave the grid little room (narrow window, large text), so
// focus moved on request must also reach the window, not only the grid's own viewport.
function focusInWindow(element: HTMLElement): void {
  element.focus({ preventScroll: true });
  const target = element.closest('[role="row"]') ?? element;
  const { top, bottom } = target.getBoundingClientRect();
  if (top < 0 || bottom > window.innerHeight) {
    target.scrollIntoView({ block: 'nearest' });
  }
}

export function NodeGrid({ ref }: NodeGridProps): ReactElement {
  const nodeIds = useVisibleNodeIds();
  const hasNodes = useHasNodes();
  const selectedNodeId = useSelectedNodeId();
  const { selectNode } = useUiActions();
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingFocusId = useRef<string | null>(null);
  // The row whose button has keyboard focus, kept while a commit moves or removes that row.
  const focusedRowId = useRef<string | null>(null);
  const committedNodeIds = useRef<readonly string[]>([]);
  // The gap a removed focused row left, where the keys continue while the grid holds focus.
  const gapIndex = useRef(-1);
  const rowHeight = useRef(ESTIMATED_ROW_HEIGHT_PX);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual returns unmemoizable functions
  const virtualizer = useVirtualizer({
    count: nodeIds.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT_PX,
    getItemKey: (index) => nodeIds[index] ?? index,
    overscan: OVERSCAN_ROWS,
    // Rows all share one height. Reading it from each new row would force a layout in the middle
    // of React's commit, so a new row takes the height the ResizeObserver last reported.
    measureElement: (_element, entry) => {
      const size = entry?.borderBoxSize[0]?.blockSize;
      if (size !== undefined) {
        rowHeight.current = Math.round(size);
      }
      return rowHeight.current;
    },
  });
  const virtualItems = virtualizer.getVirtualItems();
  const renderedIds = virtualItems.flatMap((item) => nodeIds[item.index] ?? []);
  const tabStopId =
    activeNodeId !== null && renderedIds.includes(activeNodeId) ? activeNodeId : renderedIds[0];

  const handleActivate = useCallback((nodeId: string) => {
    focusedRowId.current = nodeId;
    gapIndex.current = -1;
    setActiveNodeId(nodeId);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focusNode: (nodeId) => {
        const index = nodeIds.indexOf(nodeId);
        if (index === -1) {
          gapIndex.current = 0;
          if (gridRef.current !== null) {
            focusInWindow(gridRef.current);
          }
          return;
        }

        virtualizer.scrollToIndex(index);
        const button = document.getElementById(nodeButtonId(nodeId));
        if (button === null) {
          pendingFocusId.current = nodeId;
          setActiveNodeId(nodeId);
          return;
        }
        focusInWindow(button);
      },
    }),
    [nodeIds, virtualizer],
  );

  // A removed row takes its focus with it, and a row React moves can lose it in some browsers.
  // Give it back to the same row, or to the grid when the row is gone, so arrow keys keep working.
  useLayoutEffect(() => {
    const lostId = focusedRowId.current;
    if (lostId !== null && isFocusLost()) {
      const button = document.getElementById(nodeButtonId(lostId));
      if (button === null) {
        gapIndex.current = committedNodeIds.current.indexOf(lostId);
        gridRef.current?.focus({ preventScroll: true });
      } else {
        button.focus({ preventScroll: true });
      }
    }
    committedNodeIds.current = nodeIds;
  });

  useEffect(() => {
    const nodeId = pendingFocusId.current;
    const button = nodeId === null ? null : document.getElementById(nodeButtonId(nodeId));
    if (button !== null) {
      focusInWindow(button);
      pendingFocusId.current = null;
    }
  });

  function handleFocus(event: FocusEvent<HTMLDivElement>): void {
    if (event.target === event.currentTarget) {
      focusedRowId.current = null;
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>): void {
    const grid = event.currentTarget;
    if (event.relatedTarget instanceof Node && grid.contains(event.relatedTarget)) {
      return;
    }

    // Removing or moving a row blurs it in the middle of React's commit, before the layout effect
    // hands focus back; checked after the event, focus outside the grid means the user left it.
    queueMicrotask(() => {
      if (!grid.contains(document.activeElement)) {
        focusedRowId.current = null;
      }
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const isGridFocused = event.target === event.currentTarget;
    const targetIndex =
      isGridFocused && gapIndex.current >= 0
        ? resolveTargetFromGap(event.key, gapIndex.current, nodeIds.length)
        : resolveNavigationTarget(
            event.key,
            activeNodeId === null ? -1 : nodeIds.indexOf(activeNodeId),
            nodeIds.length,
          );
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
      ref={gridRef}
      role="grid"
      aria-label="Fleet nodes"
      aria-rowcount={nodeIds.length + HEADER_ROW_COUNT}
      tabIndex={-1}
      className={styles.grid}
      data-testid="node-grid"
      onFocus={handleFocus}
      onBlur={handleBlur}
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
