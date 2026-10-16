import { render, screen } from '@testing-library/react';
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
});
