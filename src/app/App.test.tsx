import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('shows the dashboard shell without claiming a live connection', () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'A clear view of your fleet.',
    );
    expect(screen.getByText('Telemetry is not connected yet.')).toBeVisible();
  });
});
