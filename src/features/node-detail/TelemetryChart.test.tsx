import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ChartSample } from '@/domain/chart';
import { formatLatency, formatPercent } from '@/domain/format';

import { TelemetryChart } from './TelemetryChart';

const series = [
  { metric: 'cpuLoad', label: 'CPU load', format: formatPercent },
  { metric: 'memoryUsage', label: 'Memory usage', format: formatPercent },
] as const;

function samples(count: number): ChartSample[] {
  return Array.from({ length: count }, (_, index) => ({
    timestamp: 1_000 * (index + 1),
    cpuLoad: 40 + index,
    memoryUsage: 60 - index,
    latencyMs: 100,
  }));
}

function renderChart(data: readonly ChartSample[]): void {
  render(
    <TelemetryChart
      title="Utilization"
      samples={data}
      series={series}
      yFloor={100}
      formatAxis={formatLatency}
    />,
  );
}

describe('TelemetryChart', () => {
  it('asks for more samples before it can draw a line', () => {
    renderChart(samples(1));

    expect(screen.getByText('Collecting samples...')).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('draws one line per series and describes the latest values for screen readers', () => {
    const { container } = render(
      <TelemetryChart
        title="Utilization"
        samples={samples(5)}
        series={series}
        yFloor={100}
        formatAxis={formatLatency}
      />,
    );

    expect(container.querySelectorAll('polyline')).toHaveLength(2);
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Utilization, last 4 seconds. Latest: CPU load 44.0%, Memory usage 56.0%.',
    );
  });

  it('lists every series with its latest value so color is never the only cue', () => {
    renderChart(samples(3));

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('CPU load42.0%');
    expect(items[1]).toHaveTextContent('Memory usage58.0%');
  });

  it('labels the axis with the scale used for the lines', () => {
    renderChart(samples(3));

    expect(screen.getByText('100 ms')).toBeVisible();
    expect(screen.getByText('0 ms')).toBeVisible();
  });

  it('shows dashes in the legend before any sample exists', () => {
    renderChart([]);

    expect(screen.getAllByText('—')).toHaveLength(2);
  });
});
