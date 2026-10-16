import { describe, expect, it } from 'vitest';

import { ConfigError, loadConfig } from './config.js';

describe('loadConfig', () => {
  it('uses the documented defaults when the environment is empty', () => {
    expect(loadConfig({})).toEqual({
      port: 4000,
      nodeCount: 200,
      tickMs: 100,
      updateRatio: 0.3,
      seed: 42,
      forceCritical: 3,
      dropoutRatio: 0.01,
      heartbeatMs: 2000,
      logLevel: 'info',
    });
  });

  it('applies overrides from the environment', () => {
    const config = loadConfig({
      PORT: '5000',
      NODE_COUNT: '5000',
      TICK_MS: '50',
      UPDATE_RATIO: '0.5',
      SEED: '7',
      FORCE_CRITICAL: '10',
      DROPOUT_RATIO: '0',
      LOG_LEVEL: 'debug',
    });

    expect(config).toMatchObject({
      port: 5000,
      nodeCount: 5000,
      tickMs: 50,
      updateRatio: 0.5,
      seed: 7,
      forceCritical: 10,
      dropoutRatio: 0,
      logLevel: 'debug',
    });
  });

  it('treats empty values as unset', () => {
    expect(loadConfig({ NODE_COUNT: '', SEED: '  ' })).toMatchObject({ nodeCount: 200, seed: 42 });
  });

  it.each([
    ['PORT', '0'],
    ['PORT', '70000'],
    ['PORT', 'abc'],
    ['NODE_COUNT', '0'],
    ['NODE_COUNT', '2.5'],
    ['TICK_MS', '1'],
    ['UPDATE_RATIO', '0'],
    ['UPDATE_RATIO', '1.5'],
    ['SEED', '-1'],
    ['FORCE_CRITICAL', '-1'],
    ['DROPOUT_RATIO', '2'],
    ['DROPOUT_RATIO', 'often'],
    ['LOG_LEVEL', 'verbose'],
  ])('rejects %s=%s', (name, value) => {
    expect(() => loadConfig({ [name]: value })).toThrow(ConfigError);
  });

  it('rejects forcing more critical nodes than there are nodes', () => {
    expect(() => loadConfig({ NODE_COUNT: '5', FORCE_CRITICAL: '6' })).toThrow(
      'FORCE_CRITICAL must be an integer between 0 and 5',
    );
  });
});
