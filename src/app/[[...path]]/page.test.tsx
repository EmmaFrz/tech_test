// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import DashboardPage from './page';

describe('dashboard page', () => {
  it('renders the dashboard waiting for its first snapshot', () => {
    const html = renderToString(<DashboardPage />);

    expect(html).toContain('>Fleet Ops</h1>');
    expect(html).toContain('Waiting for telemetry');
  });
});
