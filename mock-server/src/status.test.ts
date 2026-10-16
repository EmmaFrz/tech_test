import { describe, expect, it } from 'vitest';

import { deriveStatus } from './status.js';

const calm = { cpuLoad: 40, memoryUsage: 40, latencyMs: 100 };

describe('deriveStatus', () => {
  it('reports OK when every metric is below the warning thresholds', () => {
    expect(deriveStatus({ cpuLoad: 74.9, memoryUsage: 79.9, latencyMs: 299 })).toBe('OK');
  });

  it.each([
    ['cpuLoad', 75],
    ['memoryUsage', 80],
    ['latencyMs', 300],
  ])('reports WARNING when %s reaches %d', (metric, threshold) => {
    expect(deriveStatus({ ...calm, [metric]: threshold })).toBe('WARNING');
  });

  it.each([
    ['cpuLoad', 90],
    ['memoryUsage', 92],
    ['latencyMs', 800],
  ])('reports CRITICAL when %s reaches %d', (metric, threshold) => {
    expect(deriveStatus({ ...calm, [metric]: threshold })).toBe('CRITICAL');
  });

  it('prefers CRITICAL when one metric is critical and another is a warning', () => {
    expect(deriveStatus({ cpuLoad: 95, memoryUsage: 85, latencyMs: 100 })).toBe('CRITICAL');
  });
});
