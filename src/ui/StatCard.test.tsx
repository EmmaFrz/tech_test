import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('is a named group showing its label, value and caption', () => {
    render(<StatCard label="Active nodes" value="198" caption="of 200" />);

    const group = screen.getByRole('group', { name: 'Active nodes' });
    expect(group).toHaveTextContent('198');
    expect(group).toHaveTextContent('of 200');
  });

  it('announces the alert state in text for assistive technology', () => {
    render(<StatCard label="Critical" value={3} tone="alert" />);

    const group = screen.getByRole('group', { name: 'Critical' });
    expect(group).toHaveTextContent('3Alert');
    expect(group).toHaveAttribute('data-tone', 'alert');
  });

  it('adds no announcement in the neutral state', () => {
    render(<StatCard label="Warnings" value={0} />);

    expect(screen.getByRole('group', { name: 'Warnings' })).toHaveTextContent(/^Warnings0$/);
  });
});
