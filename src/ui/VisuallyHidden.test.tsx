import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VisuallyHidden } from './VisuallyHidden';

describe('VisuallyHidden', () => {
  it('keeps the text in the accessibility tree', () => {
    render(<VisuallyHidden>for screen readers</VisuallyHidden>);

    expect(screen.getByText('for screen readers')).toBeInTheDocument();
  });
});
