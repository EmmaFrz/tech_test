import { describe, expect, it } from 'vitest';

import { resolveTelemetryUrl } from './env';

describe('resolveTelemetryUrl', () => {
  it('uses ws on plain http origins', () => {
    expect(resolveTelemetryUrl({ protocol: 'http:', host: 'localhost:3000' })).toBe(
      'ws://localhost:3000/ws',
    );
  });

  it('uses wss on https origins', () => {
    expect(resolveTelemetryUrl({ protocol: 'https:', host: 'fleet.example.test' })).toBe(
      'wss://fleet.example.test/ws',
    );
  });
});
