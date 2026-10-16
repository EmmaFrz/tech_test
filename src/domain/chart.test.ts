import { describe, expect, it } from 'vitest';

import type { ChartSample } from './chart';

import { buildPolylinePoints, computeYMax, niceCeiling, windowSeconds } from './chart';

function sample(timestamp: number, overrides: Partial<ChartSample> = {}): ChartSample {
  return { timestamp, cpuLoad: 50, memoryUsage: 25, latencyMs: 100, ...overrides };
}

describe('niceCeiling', () => {
  it.each([
    [0, 1],
    [1, 1],
    [1.5, 2],
    [34, 50],
    [100, 100],
    [134, 200],
    [480, 500],
    [910, 1000],
    [1001, 2000],
  ])('rounds %d up to %d', (value, expected) => {
    expect(niceCeiling(value)).toBe(expected);
  });
});

describe('computeYMax', () => {
  it('never goes below the floor', () => {
    expect(computeYMax([sample(0)], ['latencyMs'], 500)).toBe(500);
  });

  it('grows to a nice number above the highest value of the requested metrics', () => {
    const samples = [sample(0, { latencyMs: 120 }), sample(1, { latencyMs: 730 })];

    expect(computeYMax(samples, ['latencyMs'], 100)).toBe(1000);
  });

  it('ignores metrics that are not charted', () => {
    const samples = [sample(0, { latencyMs: 5_000, cpuLoad: 40 })];

    expect(computeYMax(samples, ['cpuLoad'], 100)).toBe(100);
  });
});

describe('windowSeconds', () => {
  it('measures the span covered by the samples', () => {
    expect(windowSeconds([sample(1_000), sample(41_000)])).toBe(40);
  });

  it('is zero without samples', () => {
    expect(windowSeconds([])).toBe(0);
  });
});

describe('buildPolylinePoints', () => {
  const viewport = { width: 100, height: 50, yMax: 100 };

  it('is empty without samples', () => {
    expect(buildPolylinePoints([], 'cpuLoad', viewport)).toBe('');
  });

  it('spreads points over the width by timestamp and flips the y axis', () => {
    const samples = [
      sample(0, { cpuLoad: 0 }),
      sample(100, { cpuLoad: 100 }),
      sample(400, { cpuLoad: 50 }),
    ];

    expect(buildPolylinePoints(samples, 'cpuLoad', viewport)).toBe('0.0,50.0 25.0,0.0 100.0,25.0');
  });

  it('keeps values above the scale inside the viewport', () => {
    const samples = [sample(0, { cpuLoad: 250 }), sample(10, { cpuLoad: -5 })];

    expect(buildPolylinePoints(samples, 'cpuLoad', viewport)).toBe('0.0,0.0 100.0,50.0');
  });

  it('places a lone sample at the left edge', () => {
    expect(buildPolylinePoints([sample(5)], 'cpuLoad', viewport)).toBe('0.0,25.0');
  });
});
