export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Readonly<Record<string, unknown>>;

export interface Logger {
  readonly debug: (message: string, context?: LogContext) => void;
  readonly info: (message: string, context?: LogContext) => void;
  readonly warn: (message: string, context?: LogContext) => void;
  readonly error: (message: string, context?: LogContext) => void;
}

export const DEBUG_STORAGE_KEY = 'fleetops:debug';

function readEnabledNamespaces(): readonly string[] {
  try {
    const raw = window.localStorage.getItem(DEBUG_STORAGE_KEY);
    return raw === null ? [] : raw.split(',').map((namespace) => namespace.trim());
  } catch {
    // Storage can be blocked (privacy mode); logging must never throw.
    return [];
  }
}

function isNamespaceEnabled(namespace: string): boolean {
  const enabled = readEnabledNamespaces();
  return enabled.includes('*') || enabled.includes(namespace);
}

function emit(level: LogLevel, namespace: string, message: string, context?: LogContext): void {
  const label = `[${namespace}] ${message}`;
  if (context === undefined) {
    console[level](label);
    return;
  }

  console[level](label, context);
}

/**
 * Warnings and errors always print. Debug and info print only for namespaces listed in
 * `localStorage['fleetops:debug']` (comma separated, `*` for all).
 */
export function createLogger(namespace: string): Logger {
  return {
    debug: (message, context) => {
      if (isNamespaceEnabled(namespace)) {
        emit('debug', namespace, message, context);
      }
    },
    info: (message, context) => {
      if (isNamespaceEnabled(namespace)) {
        emit('info', namespace, message, context);
      }
    },
    warn: (message, context) => emit('warn', namespace, message, context),
    error: (message, context) => emit('error', namespace, message, context),
  };
}
