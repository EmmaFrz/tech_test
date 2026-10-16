import { describe, expect, it } from 'vitest';

import { isNodeStatus, STATUS_SEVERITY } from './status';

describe('isNodeStatus', () => {
  it.each(['OK', 'WARNING', 'CRITICAL'])('accepts %s', (status) => {
    expect(isNodeStatus(status)).toBe(true);
  });

  it.each(['ok', 'FAILED', '', null, undefined, 1])('rejects %s', (value) => {
    expect(isNodeStatus(value)).toBe(false);
  });
});

describe('STATUS_SEVERITY', () => {
  it('ranks CRITICAL above WARNING above OK', () => {
    expect(STATUS_SEVERITY.CRITICAL).toBeGreaterThan(STATUS_SEVERITY.WARNING);
    expect(STATUS_SEVERITY.WARNING).toBeGreaterThan(STATUS_SEVERITY.OK);
  });
});
