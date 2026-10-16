import { describe, expect, it } from 'vitest';

import {
  formatAverageLatency,
  formatElapsed,
  formatLatency,
  formatPercent,
  formatUtcTime,
  formatWholePercent,
} from './format';

describe('formatPercent', () => {
  it('shows one decimal and a percent sign', () => {
    expect(formatPercent(94)).toBe('94.0%');
    expect(formatPercent(7.25)).toBe('7.3%');
  });
});

describe('formatWholePercent', () => {
  it('rounds to a whole number for axis labels', () => {
    expect(formatWholePercent(100)).toBe('100%');
    expect(formatWholePercent(49.6)).toBe('50%');
  });
});

describe('formatLatency', () => {
  it('rounds to whole milliseconds', () => {
    expect(formatLatency(912.4)).toBe('912 ms');
  });
});

describe('formatAverageLatency', () => {
  it('shows a dash when there is nothing to average', () => {
    expect(formatAverageLatency(null)).toBe('—');
    expect(formatAverageLatency(184.2)).toBe('184 ms');
  });
});

describe('formatElapsed', () => {
  it.each([
    [0, '0.0s'],
    [200, '0.2s'],
    [9_949, '9.9s'],
    [10_000, '10s'],
    [59_999, '59s'],
    [60_000, '1m'],
    [185_000, '3m'],
  ])('formats %d ms as %s', (elapsedMs, expected) => {
    expect(formatElapsed(elapsedMs)).toBe(expected);
  });
});

describe('formatUtcTime', () => {
  it('formats the time of day in UTC regardless of the local time zone', () => {
    expect(formatUtcTime(Date.UTC(2026, 0, 2, 3, 4, 5, 678))).toBe('03:04:05');
  });
});
