import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Select } from './Select';

const options = [
  { value: 'latencyMs', label: 'Latency' },
  { value: 'cpuLoad', label: 'CPU' },
] as const;

describe('Select', () => {
  it('is a labelled combobox showing the current option', () => {
    render(<Select label="Sort by" options={options} value="latencyMs" onChange={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveDisplayValue('Latency');
  });

  it('reports the typed value of the chosen option', () => {
    const onChange = vi.fn();
    render(<Select label="Sort by" options={options} value="latencyMs" onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), {
      target: { value: 'cpuLoad' },
    });

    expect(onChange).toHaveBeenCalledWith('cpuLoad');
  });
});
