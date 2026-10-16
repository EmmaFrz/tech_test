import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReactElement } from 'react';
import type { MockInstance } from 'vitest';

import { RegionBoundary } from './RegionBoundary';

let shouldThrow = true;
let errorSpy: MockInstance<typeof console.error>;

function Unstable(): ReactElement {
  if (shouldThrow) {
    throw new Error('render failed');
  }
  return <p>recovered</p>;
}

describe('RegionBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its children when nothing fails', () => {
    shouldThrow = false;

    render(
      <RegionBoundary region="the grid">
        <Unstable />
      </RegionBoundary>,
    );

    expect(screen.getByText('recovered')).toBeVisible();
  });

  it('replaces a crashed region with a recoverable message that names it', () => {
    render(
      <RegionBoundary region="the grid">
        <Unstable />
      </RegionBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong in the grid.');
  });

  it('logs the failure with the region name', () => {
    render(
      <RegionBoundary region="the grid">
        <Unstable />
      </RegionBoundary>,
    );

    expect(errorSpy).toHaveBeenCalledWith(
      '[app] region crashed',
      expect.objectContaining({ region: 'the grid', error: 'render failed' }),
    );
  });

  it('shows the content again when the user retries after the cause is gone', () => {
    render(
      <RegionBoundary region="the grid">
        <Unstable />
      </RegionBoundary>,
    );
    shouldThrow = false;

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('recovered')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps a sibling region working when one region fails', () => {
    render(
      <>
        <RegionBoundary region="the grid">
          <Unstable />
        </RegionBoundary>
        <RegionBoundary region="the overview">
          <p>overview ok</p>
        </RegionBoundary>
      </>,
    );

    expect(screen.getByText('overview ok')).toBeVisible();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});
