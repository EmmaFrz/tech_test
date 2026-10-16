import { describe, expect, it } from 'vitest';

import { clamp, createRandom, randomBetween } from './prng.js';

function drawSequence(seed: number, count: number): readonly number[] {
  const random = createRandom(seed);
  return Array.from({ length: count }, () => random());
}

describe('createRandom', () => {
  it('produces the same sequence for the same seed', () => {
    expect(drawSequence(42, 20)).toEqual(drawSequence(42, 20));
  });

  it('produces different sequences for different seeds', () => {
    expect(drawSequence(1, 20)).not.toEqual(drawSequence(2, 20));
  });

  it('returns values in [0, 1)', () => {
    const values = drawSequence(7, 1_000);

    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});

describe('randomBetween', () => {
  it('maps the generator output into the requested range', () => {
    const random = createRandom(3);

    const values = Array.from({ length: 500 }, () => randomBetween(random, 10, 20));

    expect(values.every((value) => value >= 10 && value < 20)).toBe(true);
  });
});

describe('clamp', () => {
  it.each([
    [-5, 0],
    [50, 50],
    [150, 100],
  ])('limits %d to %d within [0, 100]', (value, expected) => {
    expect(clamp(value, 0, 100)).toBe(expected);
  });
});
