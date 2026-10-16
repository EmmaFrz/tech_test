import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card } from './Card';

describe('Card', () => {
  it('renders its children and defaults to the neutral tone', () => {
    render(<Card data-testid="card">content</Card>);

    expect(screen.getByTestId('card')).toHaveTextContent('content');
    expect(screen.getByTestId('card')).toHaveAttribute('data-tone', 'neutral');
  });

  it('exposes the requested tone', () => {
    render(
      <Card tone="alert" data-testid="card">
        content
      </Card>,
    );

    expect(screen.getByTestId('card')).toHaveAttribute('data-tone', 'alert');
  });
});
