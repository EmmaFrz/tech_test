import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useTelemetryStore } from '@/store';
import { resetStores } from '@/test/stores';

import { PauseToggle } from './PauseToggle';

describe('PauseToggle', () => {
  beforeEach(resetStores);

  it('pauses and resumes the live view', () => {
    render(<PauseToggle />);

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(useTelemetryStore.getState().paused).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(useTelemetryStore.getState().paused).toBe(false);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });
});
