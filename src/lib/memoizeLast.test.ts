import { describe, expect, it, vi } from 'vitest';

import { memoizeLast } from './memoizeLast';

describe('memoizeLast', () => {
  it('reuses the result while the arguments keep the same identity', () => {
    const compute = vi.fn((values: readonly number[]) => values.length);
    const memoized = memoizeLast(compute);
    const input = [1, 2, 3];

    expect(memoized(input)).toBe(3);
    expect(memoized(input)).toBe(3);

    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('recomputes when an argument changes', () => {
    const compute = vi.fn((left: number, right: number) => left + right);
    const memoized = memoizeLast(compute);

    memoized(1, 2);
    memoized(1, 3);

    expect(compute).toHaveBeenCalledTimes(2);
  });
});
