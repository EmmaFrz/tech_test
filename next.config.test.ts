import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from 'next/constants.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import createConfig from './next.config';

describe('next config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds a standalone server without the powered-by header', () => {
    const config = createConfig(PHASE_PRODUCTION_BUILD);

    expect(config.output).toBe('standalone');
    expect(config.poweredByHeader).toBe(false);
    expect(config.productionBrowserSourceMaps).toBe(true);
  });

  it('leaves /ws to the edge in production', () => {
    expect(createConfig(PHASE_PRODUCTION_BUILD).rewrites).toBeUndefined();
    expect(createConfig(PHASE_PRODUCTION_BUILD).allowedDevOrigins).toBeUndefined();
  });

  it('proxies /ws to the local mock server in development', async () => {
    vi.stubEnv('WS_PROXY_TARGET', undefined);

    const rewrites = await createConfig(PHASE_DEVELOPMENT_SERVER).rewrites?.();

    expect(rewrites).toEqual([{ source: '/ws', destination: 'http://localhost:4000/ws' }]);
    expect(createConfig(PHASE_DEVELOPMENT_SERVER).allowedDevOrigins).toEqual(['web-dev']);
  });

  it('proxies /ws to the configured target in development', async () => {
    vi.stubEnv('WS_PROXY_TARGET', 'http://mock-server:4000');

    const rewrites = await createConfig(PHASE_DEVELOPMENT_SERVER).rewrites?.();

    expect(rewrites).toEqual([{ source: '/ws', destination: 'http://mock-server:4000/ws' }]);
  });
});
