import { describe, expect, it } from 'vitest';

import { nodeButtonId, resolveNavigationTarget } from './gridNavigation';

describe('resolveNavigationTarget', () => {
  it.each([
    ['ArrowDown', 3, 4],
    ['ArrowUp', 3, 2],
    ['Home', 3, 0],
    ['End', 3, 19],
    ['PageDown', 3, 13],
    ['PageUp', 15, 5],
  ])('moves %s from row %d to row %d', (key, current, expected) => {
    expect(resolveNavigationTarget(key, current, 20)).toBe(expected);
  });

  it('stops at the first and last rows', () => {
    expect(resolveNavigationTarget('ArrowUp', 0, 20)).toBe(0);
    expect(resolveNavigationTarget('ArrowDown', 19, 20)).toBe(19);
    expect(resolveNavigationTarget('PageDown', 15, 20)).toBe(19);
    expect(resolveNavigationTarget('PageUp', 3, 20)).toBe(0);
  });

  it('starts from the first row when nothing is focused yet', () => {
    expect(resolveNavigationTarget('ArrowDown', -1, 20)).toBe(1);
  });

  it('ignores keys that are not navigation keys', () => {
    expect(resolveNavigationTarget('a', 3, 20)).toBeNull();
    expect(resolveNavigationTarget('Enter', 3, 20)).toBeNull();
  });

  it('has nowhere to go without rows', () => {
    expect(resolveNavigationTarget('ArrowDown', 0, 0)).toBeNull();
  });
});

describe('nodeButtonId', () => {
  it('derives a stable element ID from the node ID', () => {
    expect(nodeButtonId('node-0042')).toBe('node-button-node-0042');
  });
});
