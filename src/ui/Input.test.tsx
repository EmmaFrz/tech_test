import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Input } from './Input';

describe('Input', () => {
  it('is reachable by its accessible label even though the label is visually hidden', () => {
    render(<Input label="Search nodes" value="" onValueChange={vi.fn()} placeholder="node id" />);

    expect(screen.getByRole('textbox', { name: 'Search nodes' })).toHaveAttribute(
      'placeholder',
      'node id',
    );
  });

  it('reports the typed text', () => {
    const onValueChange = vi.fn();
    render(<Input label="Search nodes" value="" onValueChange={onValueChange} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '0042' } });

    expect(onValueChange).toHaveBeenCalledWith('0042');
  });

  it('shows the controlled value', () => {
    render(<Input label="Search nodes" value="0042" onValueChange={vi.fn()} />);

    expect(screen.getByRole('textbox')).toHaveValue('0042');
  });
});
