import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TelemetryProvider } from './TelemetryProvider';

const { stopTelemetry, startTelemetry } = vi.hoisted(() => {
  const stop = vi.fn();
  return { stopTelemetry: stop, startTelemetry: vi.fn(() => stop) };
});

vi.mock('./startTelemetry', () => ({ startTelemetry }));

describe('TelemetryProvider', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders its children', () => {
    render(
      <TelemetryProvider>
        <p>dashboard</p>
      </TelemetryProvider>,
    );

    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('starts telemetry on mount and stops it on unmount', () => {
    const { unmount } = render(<TelemetryProvider>content</TelemetryProvider>);
    expect(startTelemetry).toHaveBeenCalledTimes(1);
    expect(stopTelemetry).not.toHaveBeenCalled();

    unmount();

    expect(stopTelemetry).toHaveBeenCalledTimes(1);
  });
});
