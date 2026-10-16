import { ConfigError, loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createTelemetryServer } from './server.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const logger = createLogger(config.logLevel);
  const server = createTelemetryServer({ config, logger });

  function shutdown(signal: string): void {
    logger.info('shutting down', { signal });
    server.stop().then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error('shutdown failed', { error: String(error) });
        process.exit(1);
      },
    );
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  await server.start();
}

main().catch((error: unknown) => {
  const logger = createLogger('error');
  const message = error instanceof ConfigError ? 'invalid configuration' : 'startup failed';
  logger.error(message, { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
