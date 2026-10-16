import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SegmentedControl } from './SegmentedControl';

const options = [
  { value: 'ALL', label: 'All', count: 200 },
  { value: 'CRITICAL', label: 'CRITICAL', count: 3 },
] as const;

describe('SegmentedControl', () => {
  it('is a labelled radio group with the counts in each option name', () => {
    render(<SegmentedControl label="Status" options={options} value="ALL" onChange={vi.fn()} />);

    expect(screen.getByRole('radiogroup', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All 200' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'CRITICAL 3' })).not.toBeChecked();
  });

  it('reports the chosen value', () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Status" options={options} value="ALL" onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'CRITICAL 3' }));

    expect(onChange).toHaveBeenCalledWith('CRITICAL');
  });

  it('works without counts', () => {
    render(
      <SegmentedControl
        label="Mode"
        options={[{ value: 'a', label: 'Alpha' }]}
        value="a"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Alpha' })).toBeChecked();
  });
});
