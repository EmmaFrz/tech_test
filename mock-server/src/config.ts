import type { LogLevel } from './logger.js';

import { isLogLevel } from './logger.js';

export interface ServerConfig {
  readonly port: number;
  readonly nodeCount: number;
  readonly tickMs: number;
  readonly updateRatio: number;
  readonly seed: number;
  readonly forceCritical: number;
  readonly dropoutRatio: number;
  readonly heartbeatMs: number;
  readonly logLevel: LogLevel;
}

export type Environment = Readonly<Record<string, string | undefined>>;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const HEARTBEAT_MS = 2_000;
const MAX_NODE_COUNT = 100_000;

interface Range {
  readonly min: number;
  readonly max: number;
}

function readRaw(env: Environment, name: string): string | undefined {
  const raw = env[name]?.trim();
  return raw === undefined || raw === '' ? undefined : raw;
}

function readInteger(env: Environment, name: string, fallback: number, range: Range): number {
  const raw = readRaw(env, name);
  if (raw === undefined) {
    return fallback;
  }

  const value = Number(raw);
  if (
    !/^\d+$/.test(raw) ||
    !Number.isSafeInteger(value) ||
    value < range.min ||
    value > range.max
  ) {
    throw new ConfigError(`${name} must be an integer between ${range.min} and ${range.max}`);
  }

  return value;
}

function readRatio(env: Environment, name: string, fallback: number, range: Range): number {
  const raw = readRaw(env, name);
  if (raw === undefined) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < range.min || value > range.max) {
    throw new ConfigError(`${name} must be a number between ${range.min} and ${range.max}`);
  }

  return value;
}

function readLogLevel(env: Environment): LogLevel {
  const raw = readRaw(env, 'LOG_LEVEL');
  if (raw === undefined) {
    return 'info';
  }

  if (!isLogLevel(raw)) {
    throw new ConfigError('LOG_LEVEL must be one of debug, info, warn, error');
  }

  return raw;
}

/** Reads and validates the process environment; throws `ConfigError` on the first invalid value. */
export function loadConfig(env: Environment): ServerConfig {
  const nodeCount = readInteger(env, 'NODE_COUNT', 200, { min: 1, max: MAX_NODE_COUNT });
  const forceCritical = readInteger(env, 'FORCE_CRITICAL', 3, { min: 0, max: nodeCount });

  return {
    port: readInteger(env, 'PORT', 4_000, { min: 1, max: 65_535 }),
    nodeCount,
    tickMs: readInteger(env, 'TICK_MS', 100, { min: 10, max: 60_000 }),
    updateRatio: readRatio(env, 'UPDATE_RATIO', 0.3, { min: 0.001, max: 1 }),
    seed: readInteger(env, 'SEED', 42, { min: 0, max: 4_294_967_295 }),
    forceCritical,
    dropoutRatio: readRatio(env, 'DROPOUT_RATIO', 0.01, { min: 0, max: 1 }),
    heartbeatMs: HEARTBEAT_MS,
    logLevel: readLogLevel(env),
  };
}
