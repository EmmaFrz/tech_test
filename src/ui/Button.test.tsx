import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('calls onClick when pressed', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Pause</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is a plain button by default so it never submits a form', () => {
    render(<Button>Pause</Button>);

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('reports a toggled state to assistive technology', () => {
    render(<Button aria-pressed>Paused</Button>);

    expect(screen.getByRole('button', { pressed: true })).toBeInTheDocument();
  });

  it('does not fire clicks while disabled', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Pause
      </Button>,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(onClick).not.toHaveBeenCalled();
  });
});
