import { describe, expect, it } from 'vitest';

import { createDictionary } from './dictionary';

describe('createDictionary', () => {
  it('has no inherited entries', () => {
    const dictionary = createDictionary<number>();

    expect(Object.getPrototypeOf(dictionary)).toBeNull();
    expect('toString' in dictionary).toBe(false);
    expect('constructor' in dictionary).toBe(false);
    expect('__proto__' in dictionary).toBe(false);
  });

  it('stores __proto__ as an ordinary key instead of replacing the prototype', () => {
    const dictionary = createDictionary<{ readonly status: string }>();

    dictionary['__proto__'] = { status: 'CRITICAL' };

    expect(Object.keys(dictionary)).toEqual(['__proto__']);
    expect(dictionary['status']).toBeUndefined();
    expect(Object.getPrototypeOf(dictionary)).toBeNull();
  });

  it('copies every own entry of the source, including an own __proto__ key', () => {
    const source = Object.fromEntries([
      ['a', 1],
      ['__proto__', 2],
    ]);

    const copy = createDictionary(source);

    expect(Object.entries(copy)).toEqual([
      ['a', 1],
      ['__proto__', 2],
    ]);
    expect(Object.getPrototypeOf(copy)).toBeNull();
  });
});
