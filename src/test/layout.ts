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
