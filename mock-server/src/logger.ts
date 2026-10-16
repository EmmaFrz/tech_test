export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export type LogContext = Readonly<Record<string, unknown>>;

export interface Logger {
  readonly debug: (message: string, context?: LogContext) => void;
  readonly info: (message: string, context?: LogContext) => void;
  readonly warn: (message: string, context?: LogContext) => void;
  readonly error: (message: string, context?: LogContext) => void;
}

export function isLogLevel(value: string): value is LogLevel {
  return LOG_LEVELS.some((level) => level === value);
}

function writeToStdout(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Emits one JSON line per event; events below `minimumLevel` are discarded. */
export function createLogger(
  minimumLevel: LogLevel,
  write: (line: string) => void = writeToStdout,
): Logger {
  const minimumRank = LOG_LEVELS.indexOf(minimumLevel);

  function log(level: LogLevel, message: string, context: LogContext = {}): void {
    if (LOG_LEVELS.indexOf(level) < minimumRank) {
      return;
    }

    write(JSON.stringify({ time: new Date().toISOString(), level, message, ...context }));
  }

  return {
    debug: (message, context) => log('debug', message, context),
    info: (message, context) => log('info', message, context),
    warn: (message, context) => log('warn', message, context),
    error: (message, context) => log('error', message, context),
  };
}
