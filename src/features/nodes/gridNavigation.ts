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

export function nodeButtonId(nodeId: string): string {
  return `node-button-${nodeId}`;
}
