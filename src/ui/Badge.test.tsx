import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { NodeStatus } from '@shared/protocol';

import { Badge } from './Badge';

const STATUSES: readonly NodeStatus[] = ['OK', 'WARNING', 'CRITICAL'];

describe('Badge', () => {
  it.each(STATUSES)('exposes the %s status as text, not only as color', (status) => {
    render(<Badge status={status} />);

    expect(screen.getByText(status)).toBeVisible();
  });

  it('adds an icon that is hidden from assistive technology', () => {
    const { container } = render(<Badge status="CRITICAL" />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders a distinct icon shape for every status', () => {
    const shapes = STATUSES.map((status) => {
      const { container, unmount } = render(<Badge status={status} />);
      const shape = container.querySelector('path')?.getAttribute('d');
      unmount();
      return shape;
    });

    expect(new Set(shapes).size).toBe(STATUSES.length);
  });

  it('marks the status for styling and tests', () => {
    const { container } = render(<Badge status="WARNING" />);

    expect(container.firstElementChild).toHaveAttribute('data-status', 'WARNING');
  });
});
