const PAGE_SIZE = 10;

/**
 * Maps a navigation key to the row index that should receive focus, or null when the key is
 * not a navigation key or there is nothing to focus.
 */
export function resolveNavigationTarget(
  key: string,
  currentIndex: number,
  rowCount: number,
): number | null {
  if (rowCount === 0) {
    return null;
  }

  const lastIndex = rowCount - 1;
  const index = Math.min(Math.max(currentIndex, 0), lastIndex);

  switch (key) {
    case 'ArrowDown':
      return Math.min(index + 1, lastIndex);
    case 'ArrowUp':
      return Math.max(index - 1, 0);
    case 'PageDown':
      return Math.min(index + PAGE_SIZE, lastIndex);
    case 'PageUp':
      return Math.max(index - PAGE_SIZE, 0);
    case 'Home':
      return 0;
    case 'End':
      return lastIndex;
    default:
      return null;
  }
}

/**
 * Navigation from the gap a removed row left at `gapIndex`, once the grid itself holds focus: the
 * row that moved into its place is the next one down, the row above it the next one up.
 */
export function resolveTargetFromGap(
  key: string,
  gapIndex: number,
  rowCount: number,
): number | null {
  if (rowCount === 0) {
    return null;
  }

  const lastIndex = rowCount - 1;
  const clamp = (index: number): number => Math.min(Math.max(index, 0), lastIndex);

  switch (key) {
    case 'ArrowDown':
      return clamp(gapIndex);
    case 'ArrowUp':
      return clamp(gapIndex - 1);
    case 'PageDown':
      return clamp(gapIndex + PAGE_SIZE - 1);
    case 'PageUp':
      return clamp(gapIndex - PAGE_SIZE);
    default:
      return resolveNavigationTarget(key, gapIndex, rowCount);
  }
}

export function nodeButtonId(nodeId: string): string {
  return `node-button-${nodeId}`;
}
