import type { ReactElement } from 'react';

import { formatAverageLatency } from '@/domain/format';
import { useFleetMetrics } from '@/store';
import { StatCard } from '@/ui';

import styles from './MetricsOverview.module.css';

export function MetricsOverview(): ReactElement {
  const metrics = useFleetMetrics();

  return (
    <section aria-label="Fleet overview" className={styles.overview}>
      <StatCard
        label="Active nodes"
        value={`${metrics.activeNodes} / ${metrics.totalNodes}`}
        caption={metrics.staleNodes > 0 ? `${metrics.staleNodes} stale` : 'all reporting'}
      />
      <StatCard
        label="Critical alerts"
        value={metrics.criticalCount}
        caption={metrics.criticalCount > 0 ? 'nodes need immediate attention' : 'no critical nodes'}
        tone={metrics.criticalCount > 0 ? 'alert' : 'neutral'}
      />
      <StatCard
        label="Warnings"
        value={metrics.warningCount}
        caption={metrics.warningCount > 0 ? 'nodes approaching limits' : 'no warnings'}
        tone={metrics.warningCount > 0 ? 'warning' : 'neutral'}
      />
      <StatCard
        label="Average latency"
        value={formatAverageLatency(metrics.averageLatencyMs)}
        caption="across active nodes"
      />
    </section>
  );
}
