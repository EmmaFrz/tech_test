import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { Panel } from './Panel';

describe('Panel', () => {
  it('is a region named by its title and shows its content', () => {
    render(<Panel title="node-0042">details</Panel>);

    expect(screen.getByRole('region', { name: 'node-0042' })).toHaveTextContent('details');
  });

  it('renders header actions when provided', () => {
    render(
      <Panel title="Details" actions={<button type="button">Close</button>}>
        body
      </Panel>,
    );

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('forwards a ref to its region so callers can move focus into it', () => {
    const ref = createRef<HTMLElement>();
    render(
      <Panel ref={ref} title="Details" tabIndex={-1}>
        body
      </Panel>,
    );

    ref.current?.focus();

    expect(screen.getByRole('region', { name: 'Details' })).toHaveFocus();
  });
});
