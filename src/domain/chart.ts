export interface ChartSample {
  readonly timestamp: number;
  readonly cpuLoad: number;
  readonly memoryUsage: number;
  readonly latencyMs: number;
}

export type ChartMetric = 'cpuLoad' | 'memoryUsage' | 'latencyMs';

export interface ChartViewport {
  readonly width: number;
  readonly height: number;
  readonly yMax: number;
}

const NICE_MULTIPLIERS = [1, 2, 5, 10] as const;

/** Rounds up to 1, 2 or 5 times a power of ten so axis labels stay readable. */
export function niceCeiling(value: number): number {
  if (value <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const multiplier = NICE_MULTIPLIERS.find((candidate) => value <= candidate * magnitude);
  return (multiplier ?? 10) * magnitude;
}

export function computeYMax(
  samples: readonly ChartSample[],
  metrics: readonly ChartMetric[],
  floor: number,
): number {
  const highest = samples.reduce(
    (current, sample) => Math.max(current, ...metrics.map((metric) => sample[metric])),
    floor,
  );
  return niceCeiling(highest);
}

export function windowSeconds(samples: readonly ChartSample[]): number {
  const first = samples[0];
  const last = samples.at(-1);
  if (first === undefined || last === undefined) {
    return 0;
  }

  return Math.round((last.timestamp - first.timestamp) / 1_000);
}

/** SVG `points` attribute; x follows the sample timestamps, so uneven spacing stays truthful. */
export function buildPolylinePoints(
  samples: readonly ChartSample[],
  metric: ChartMetric,
  viewport: ChartViewport,
): string {
  const first = samples[0];
  const last = samples.at(-1);
  if (first === undefined || last === undefined) {
    return '';
  }

  const span = last.timestamp - first.timestamp;
  return samples
    .map((sample) => {
      const x = span === 0 ? 0 : ((sample.timestamp - first.timestamp) / span) * viewport.width;
      const ratio = Math.min(1, Math.max(0, sample[metric] / viewport.yMax));
      const y = viewport.height - ratio * viewport.height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
