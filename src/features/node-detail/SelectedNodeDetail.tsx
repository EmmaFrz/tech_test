import type { ReactElement } from 'react';

import { formatLatency, formatPercent, formatUtcTime, formatWholePercent } from '@/domain/format';
import { CPU_THRESHOLDS, MEMORY_THRESHOLDS } from '@/domain/thresholds';
import { useIsNodeStale, useIsNodeVisible, useNodeById, useNodeHistory } from '@/store';
import { Badge, EmptyState, MeterBar } from '@/ui';

import styles from './SelectedNodeDetail.module.css';
import { TelemetryChart } from './TelemetryChart';

export interface SelectedNodeDetailProps {
  readonly nodeId: string;
}

const UTILIZATION_SERIES = [
  { metric: 'cpuLoad', label: 'CPU load', format: formatPercent },
  { metric: 'memoryUsage', label: 'Memory usage', format: formatPercent },
] as const;

const LATENCY_SERIES = [{ metric: 'latencyMs', label: 'Latency', format: formatLatency }] as const;

const LATENCY_AXIS_FLOOR_MS = 500;
const PERCENT_AXIS_FLOOR = 100;

export function SelectedNodeDetail({ nodeId }: SelectedNodeDetailProps): ReactElement {
  const node = useNodeById(nodeId);
  const isStale = useIsNodeStale(nodeId);
  const isVisible = useIsNodeVisible(nodeId);
  const samples = useNodeHistory(nodeId);

  if (node === undefined) {
    return (
      <EmptyState title="Node not reported" description="No telemetry is known for this node." />
    );
  }

  return (
    <div className={styles.detail}>
      <div className={styles.summary}>
        <Badge status={node.status} />
        {isStale ? <span className={styles.staleTag}>STALE</span> : null}
      </div>
      {isVisible ? null : (
        <p className={styles.hint}>Hidden by the current filter or search, but still live.</p>
      )}
      <dl className={styles.values}>
        <div className={styles.value}>
          <dt>CPU load</dt>
          <dd>
            <MeterBar label="CPU load" value={node.cpuLoad} thresholds={CPU_THRESHOLDS} />
            {formatPercent(node.cpuLoad)}
          </dd>
        </div>
        <div className={styles.value}>
          <dt>Memory usage</dt>
          <dd>
            <MeterBar
              label="Memory usage"
              value={node.memoryUsage}
              thresholds={MEMORY_THRESHOLDS}
            />
            {formatPercent(node.memoryUsage)}
          </dd>
        </div>
        <div className={styles.value}>
          <dt>Latency</dt>
          <dd>{formatLatency(node.latencyMs)}</dd>
        </div>
        <div className={styles.value}>
          <dt>Last update (UTC)</dt>
          <dd>{formatUtcTime(node.timestamp)}</dd>
        </div>
      </dl>
      <TelemetryChart
        title="Utilization"
        samples={samples}
        series={UTILIZATION_SERIES}
        yFloor={PERCENT_AXIS_FLOOR}
        formatAxis={formatWholePercent}
      />
      <TelemetryChart
        title="Latency"
        samples={samples}
        series={LATENCY_SERIES}
        yFloor={LATENCY_AXIS_FLOOR_MS}
        formatAxis={formatLatency}
      />
    </div>
  );
}
