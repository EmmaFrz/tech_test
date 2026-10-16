import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NodeStatus } from '@shared/protocol';

import { PULSE_DURATION_MS, useCriticalPulse } from './useCriticalPulse';

describe('useCriticalPulse', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderStatus(initial: NodeStatus | undefined) {
    return renderHook(({ status }) => useCriticalPulse(status), {
      initialProps: { status: initial },
    });
  }

  it('does not pulse for a node that is already critical when it first appears', () => {
    const { result } = renderStatus('CRITICAL');

    expect(result.current).toBe(false);
  });

  it('pulses when a node turns critical', () => {
    const { result, rerender } = renderStatus('OK');

    rerender({ status: 'CRITICAL' });

    expect(result.current).toBe(true);
  });

  it('stops pulsing after the pulse duration', () => {
    const { result, rerender } = renderStatus('WARNING');
    rerender({ status: 'CRITICAL' });

    act(() => {
      vi.advanceTimersByTime(PULSE_DURATION_MS - 1);
    });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
  });

  it('does not pulse when a node recovers or moves between non-critical statuses', () => {
    const { result, rerender } = renderStatus('CRITICAL');

    rerender({ status: 'WARNING' });
    expect(result.current).toBe(false);

    rerender({ status: 'OK' });
    expect(result.current).toBe(false);
  });

  it('pulses again when the node re-enters critical', () => {
    const { result, rerender } = renderStatus('OK');
    rerender({ status: 'CRITICAL' });
    act(() => {
      vi.advanceTimersByTime(PULSE_DURATION_MS);
    });

    rerender({ status: 'OK' });
    rerender({ status: 'CRITICAL' });

    expect(result.current).toBe(true);
  });

  it('does not pulse when the first status arrives after the node was unknown', () => {
    const { result, rerender } = renderStatus(undefined);

    rerender({ status: 'CRITICAL' });

    expect(result.current).toBe(false);
  });
});
