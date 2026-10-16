import { describe, expect, it } from 'vitest';

import type { Logger, LogLevel } from './logger.js';

import { createLogger, isLogLevel } from './logger.js';

function captureLines(level: LogLevel): { readonly lines: string[]; readonly logger: Logger } {
  const lines: string[] = [];
  return { lines, logger: createLogger(level, (line) => lines.push(line)) };
}

describe('createLogger', () => {
  it('writes one JSON line per event with level, message and context', () => {
    const { lines, logger } = captureLines('debug');

    logger.info('server listening', { port: 4000 });

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({
      level: 'info',
      message: 'server listening',
      port: 4000,
    });
  });

  it('discards events below the minimum level', () => {
    const { lines, logger } = captureLines('warn');

    logger.debug('ignored');
    logger.info('ignored');
    logger.warn('kept');
    logger.error('kept');

    expect(lines).toHaveLength(2);
  });
});

describe('isLogLevel', () => {
  it('accepts known levels and rejects anything else', () => {
    expect(isLogLevel('warn')).toBe(true);
    expect(isLogLevel('trace')).toBe(false);
  });
});
