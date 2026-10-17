import { act } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { createMatchMedia } from '@/test/layout';

import { Dashboard } from './Dashboard';

vi.mock('./startTelemetry', () => ({ startTelemetry: vi.fn(() => () => undefined) }));

describe('hydration', () => {
  it.each([false, true])('hydrates without a mismatch with narrow layout %s', async (isNarrow) => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      createMatchMedia((query) => isNarrow && query.includes('max-width')),
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const recoverableErrors: unknown[] = [];
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Dashboard />);
    document.body.append(container);

    const root = await act(() =>
      hydrateRoot(container, <Dashboard />, {
        onRecoverableError: (error) => recoverableErrors.push(error),
      }),
    );

    expect(recoverableErrors).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
    expect(container.querySelector('h1')).toHaveTextContent('Fleet Ops');

    act(() => root.unmount());
    container.remove();
  });
});
