import type { ReactElement } from 'react';

import type { ChartMetric, ChartSample, ChartViewport } from '@/domain/chart';
import { buildPolylinePoints, computeYMax, windowSeconds } from '@/domain/chart';

import styles from './TelemetryChart.module.css';

export interface ChartSeries {
  readonly metric: ChartMetric;
  readonly label: string;
  readonly format: (value: number) => string;
}

export interface TelemetryChartProps {
  readonly title: string;
  readonly samples: readonly ChartSample[];
  readonly series: readonly ChartSeries[];
  readonly yFloor: number;
  readonly formatAxis: (value: number) => string;
}

const VIEWPORT_WIDTH = 300;
const VIEWPORT_HEIGHT = 120;
const MIN_SAMPLES = 2;
const GRID_LINE_RATIOS = [0, 0.5, 1] as const;

const SERIES_CLASS: Readonly<Record<ChartMetric, string | undefined>> = {
  cpuLoad: styles.cpu,
  memoryUsage: styles.memory,
  latencyMs: styles.latency,
};

function describeChart(
  title: string,
  samples: readonly ChartSample[],
  series: readonly ChartSeries[],
): string {
  const latest = samples.at(-1);
  if (latest === undefined) {
    return `${title}: no data yet`;
  }

  const values = series.map((item) => `${item.label} ${item.format(latest[item.metric])}`);
  return `${title}, last ${windowSeconds(samples)} seconds. Latest: ${values.join(', ')}.`;
}

export function TelemetryChart({
  title,
  samples,
  series,
  yFloor,
  formatAxis,
}: TelemetryChartProps): ReactElement {
  const latest = samples.at(-1);
  const yMax = computeYMax(
    samples,
    series.map((item) => item.metric),
    yFloor,
  );
  const viewport: ChartViewport = { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT, yMax };

  return (
    <figure className={styles.chart} data-testid="telemetry-chart">
      <figcaption className={styles.title}>{title}</figcaption>
      {samples.length < MIN_SAMPLES ? (
        <p className={styles.placeholder}>Collecting samples...</p>
      ) : (
        <div className={styles.plot}>
          <span className={styles.axisMax}>{formatAxis(yMax)}</span>
          <svg
            role="img"
            aria-label={describeChart(title, samples, series)}
            viewBox={`0 0 ${VIEWPORT_WIDTH} ${VIEWPORT_HEIGHT}`}
            preserveAspectRatio="none"
            className={styles.svg}
          >
            {GRID_LINE_RATIOS.map((ratio) => (
              <line
                key={ratio}
                className={styles.gridLine}
                x1={0}
                x2={VIEWPORT_WIDTH}
                y1={ratio * VIEWPORT_HEIGHT}
                y2={ratio * VIEWPORT_HEIGHT}
              />
            ))}
            {series.map((item) => (
              <polyline
                key={item.metric}
                className={`${styles.line} ${SERIES_CLASS[item.metric]}`}
                points={buildPolylinePoints(samples, item.metric, viewport)}
              />
            ))}
          </svg>
          <span className={styles.axisMin}>{formatAxis(0)}</span>
        </div>
      )}
      <ul className={styles.legend}>
        {series.map((item) => (
          <li key={item.metric} className={styles.legendItem}>
            <span className={`${styles.swatch} ${SERIES_CLASS[item.metric]}`} aria-hidden="true" />
            {item.label}
            <span className={styles.latest}>
              {latest === undefined ? '—' : item.format(latest[item.metric])}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
