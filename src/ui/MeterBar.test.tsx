import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MeterBar } from './MeterBar';

const thresholds = { warning: 75, critical: 90 } as const;

describe('MeterBar', () => {
  it('exposes the value and label to assistive technology', () => {
    render(<MeterBar label="CPU load" value={42.5} thresholds={thresholds} />);

    const meter = screen.getByRole('meter', { name: 'CPU load' });
    expect(meter).toHaveAttribute('aria-valuenow', '42.5');
    expect(meter).toHaveAttribute('aria-valuetext', '42.5%');
  });

  it.each([
    [10, 'ok'],
    [74.9, 'ok'],
    [75, 'warning'],
    [89.9, 'warning'],
    [90, 'critical'],
    [100, 'critical'],
  ])('shows %d as the %s level', (value, level) => {
    render(<MeterBar label="CPU load" value={value} thresholds={thresholds} />);

    expect(screen.getByRole('meter')).toHaveAttribute('data-level', level);
  });

  it('keeps out-of-range values inside 0 to 100', () => {
    render(<MeterBar label="CPU load" value={140} thresholds={thresholds} />);

    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100');
  });
});
