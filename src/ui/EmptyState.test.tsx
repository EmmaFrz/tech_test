import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('announces the title and description politely', () => {
    render(<EmptyState title="No nodes match" description="Try another filter." />);

    expect(screen.getByRole('status')).toHaveTextContent('No nodes match');
    expect(screen.getByText('Try another filter.')).toBeVisible();
  });

  it('renders an optional action', () => {
    render(<EmptyState title="Waiting for data" action={<button type="button">Retry</button>} />);

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
