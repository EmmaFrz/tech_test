import { memo } from 'react';

import type { CSSProperties, ReactElement } from 'react';

import { formatLatency, formatPercent, formatUtcTime } from '@/domain/format';
import { CPU_THRESHOLDS, MEMORY_THRESHOLDS } from '@/domain/thresholds';
import { useIsNodeStale, useNodeById } from '@/store';
import { Badge, MeterBar } from '@/ui';

import { nodeButtonId } from './gridNavigation';
import styles from './NodeRow.module.css';
import { useCriticalPulse } from './useCriticalPulse';

export interface NodeRowProps {
  readonly nodeId: string;
  readonly index: number;
  readonly offsetTop: number;
  readonly isSelected: boolean;
  readonly isTabStop: boolean;
  readonly onSelect: (nodeId: string) => void;
  readonly onActivate: (nodeId: string) => void;
  readonly measureRef: (element: Element | null) => void;
}

const HEADER_ROW_COUNT = 1;

/** Subscribes to its own node only, so a telemetry update re-renders this row and no other. */
export const NodeRow = memo(function NodeRow({
  nodeId,
  index,
  offsetTop,
  isSelected,
  isTabStop,
  onSelect,
  onActivate,
  measureRef,
}: NodeRowProps): ReactElement | null {
  const node = useNodeById(nodeId);
  const isStale = useIsNodeStale(nodeId);
  const isPulsing = useCriticalPulse(node?.status);

  if (node === undefined) {
    return null;
  }

  const classNames = [styles.row, isPulsing ? styles.pulse : undefined].filter(Boolean).join(' ');

  return (
    <div
      ref={measureRef}
      role="row"
      aria-rowindex={index + HEADER_ROW_COUNT + 1}
      aria-selected={isSelected}
      className={classNames}
      style={{ '--row-offset': `${offsetTop}px` } as CSSProperties}
      data-testid="node-row"
      data-index={index}
      data-node-id={node.nodeId}
      data-status={node.status}
      data-stale={isStale}
    >
      <div role="gridcell" className={styles.idCell}>
        <button
          id={nodeButtonId(nodeId)}
          type="button"
          className={styles.select}
          tabIndex={isTabStop ? 0 : -1}
          onClick={() => onSelect(nodeId)}
          onFocus={() => onActivate(nodeId)}
        >
          {node.nodeId}
        </button>
      </div>
      <div role="gridcell" className={styles.statusCell}>
        <Badge status={node.status} />
        {isStale ? <span className={styles.staleTag}>STALE</span> : null}
      </div>
      <div role="gridcell" className={styles.meterCell}>
        <MeterBar label="CPU load" value={node.cpuLoad} thresholds={CPU_THRESHOLDS} />
        <span className={styles.value}>{formatPercent(node.cpuLoad)}</span>
      </div>
      <div role="gridcell" className={styles.meterCell}>
        <MeterBar label="Memory usage" value={node.memoryUsage} thresholds={MEMORY_THRESHOLDS} />
        <span className={styles.value}>{formatPercent(node.memoryUsage)}</span>
      </div>
      <div role="gridcell" className={styles.value}>
        {formatLatency(node.latencyMs)}
      </div>
      <div role="gridcell" className={styles.time}>
        {formatUtcTime(node.timestamp)}
      </div>
    </div>
  );
});
