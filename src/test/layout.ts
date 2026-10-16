import { vi } from 'vitest';

export interface LayoutSizes {
  readonly viewportHeight: number;
  readonly rowHeight: number;
}

/** jsdom has no layout engine; give the virtualizer a viewport and row size to work with. */
export function mockElementLayout({ viewportHeight, rowHeight }: LayoutSizes): void {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(viewportHeight);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(rowHeight);
}

/** A `matchMedia` for jsdom, which has none, answering each query with `matches(query)`. */
export function createMatchMedia(
  matches: (query: string) => boolean,
): (query: string) => MediaQueryList {
  return (query) =>
    Object.assign(new EventTarget(), {
      matches: matches(query),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
    });
}

/** Narrow-screen layout: every `max-width` media query matches, so the detail panel is a drawer. */
export function mockNarrowLayout(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    createMatchMedia((query) => query.includes('max-width')),
  );
}
