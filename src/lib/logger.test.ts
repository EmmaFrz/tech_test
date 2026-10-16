import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLogger, DEBUG_STORAGE_KEY } from './logger';

describe('createLogger', () => {
  afterEach(() => {
    window.localStorage.removeItem(DEBUG_STORAGE_KEY);
  });

  it('always prints warnings with the namespace and context', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    createLogger('ws').warn('invalid message dropped', { total: 1 });

    expect(warn).toHaveBeenCalledWith('[ws] invalid message dropped', { total: 1 });
  });

  it('keeps debug output off unless the namespace is enabled', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const log = createLogger('ws');

    log.debug('hidden');
    window.localStorage.setItem(DEBUG_STORAGE_KEY, 'store, ws');
    log.debug('shown');

    expect(debug).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalledWith('[ws] shown');
  });

  it('enables every namespace with a wildcard', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    window.localStorage.setItem(DEBUG_STORAGE_KEY, '*');

    createLogger('anything').info('shown');

    expect(info).toHaveBeenCalledTimes(1);
  });
});
