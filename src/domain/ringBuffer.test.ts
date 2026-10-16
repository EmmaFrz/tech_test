import { describe, expect, it } from 'vitest';

import { RingBuffer } from './ringBuffer';

describe('RingBuffer', () => {
  it('keeps items in insertion order until it is full', () => {
    const buffer = new RingBuffer<number>(3);

    buffer.push(1);
    buffer.push(2);

    expect(buffer.toArray()).toEqual([1, 2]);
    expect(buffer.size).toBe(2);
  });

  it('overwrites the oldest items once capacity is exceeded', () => {
    const buffer = new RingBuffer<number>(3);

    [1, 2, 3, 4, 5].forEach((value) => buffer.push(value));

    expect(buffer.toArray()).toEqual([3, 4, 5]);
    expect(buffer.size).toBe(3);
  });

  it('returns a copy so callers cannot alter the buffer', () => {
    const buffer = new RingBuffer<number>(2);
    buffer.push(1);

    buffer.toArray().push(99);

    expect(buffer.toArray()).toEqual([1]);
  });

  it('starts over after being cleared', () => {
    const buffer = new RingBuffer<number>(2);
    [1, 2, 3].forEach((value) => buffer.push(value));

    buffer.clear();
    buffer.push(9);

    expect(buffer.toArray()).toEqual([9]);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects the invalid capacity %s', (capacity) => {
    expect(() => new RingBuffer<number>(capacity)).toThrow(RangeError);
  });
});
