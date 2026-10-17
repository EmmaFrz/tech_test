import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CRITICAL_PULSE_MS } from '@/domain/criticalEntries';

import { useCriticalPulse } from './useCriticalPulse';

describe('useCriticalPulse', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderEntry(initial: number | undefined) {
    return renderHook(({ criticalSince }) => useCriticalPulse(criticalSince), {
      initialProps: { criticalSince: initial },
    });
  }

  it('does not pulse without a recent entry into CRITICAL', () => {
    const { result } = renderEntry(undefined);

    expect(result.current).toBe(false);
  });

  it('pulses for two seconds once the node enters CRITICAL', () => {
    const { result, rerender } = renderEntry(undefined);

    rerender({ criticalSince: 1_000 });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(CRITICAL_PULSE_MS - 1);
    });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
  });

  it('pulses for a row that mounts while the entry is still recent', () => {
    const { result } = renderEntry(1_000);

    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(CRITICAL_PULSE_MS);
    });
    expect(result.current).toBe(false);
  });

  it('stops pulsing as soon as the entry goes away', () => {
    const { result, rerender } = renderEntry(1_000);

    rerender({ criticalSince: undefined });

    expect(result.current).toBe(false);
  });

  it('pulses again for a new entry', () => {
    const { result, rerender } = renderEntry(1_000);
    act(() => {
      vi.advanceTimersByTime(CRITICAL_PULSE_MS);
    });

    rerender({ criticalSince: 5_000 });

    expect(result.current).toBe(true);
  });
});
