import { createServer } from 'node:http';

import { WebSocket, WebSocketServer } from 'ws';

import type { ServerConfig } from './config.js';
import type { Logger } from './logger.js';

import type { ServerMessage } from '@shared/protocol.js';

import { createFleetSimulation } from './simulation.js';

export interface TelemetryServer {
  /** Starts listening and resolves with the bound port. */
  readonly start: () => Promise<number>;
  readonly stop: () => Promise<void>;
}

export interface TelemetryServerOptions {
  readonly config: ServerConfig;
  readonly logger: Logger;
  readonly now?: () => number;
}

// A client this far behind cannot catch up with deltas; dropping it forces a fresh snapshot.
const MAX_BUFFERED_BYTES = 8 * 1024 * 1024;

export function createTelemetryServer(options: TelemetryServerOptions): TelemetryServer {
  const { config, logger, now = Date.now } = options;
  const simulation = createFleetSimulation(config, now());
  let seq = 0;
  let timers: readonly NodeJS.Timeout[] = [];

  const httpServer = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'not found' }));
  });
  const socketServer = new WebSocketServer({ server: httpServer, path: '/ws' });

  function broadcast(message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const socket of socketServer.clients) {
      if (socket.readyState !== WebSocket.OPEN) {
        continue;
      }

      if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
        logger.warn('slow client terminated', { bufferedBytes: socket.bufferedAmount });
        socket.terminate();
        continue;
      }

      socket.send(payload);
    }
  }

  function broadcastDelta(): void {
    const updates = simulation.tick(now());
    if (updates.length === 0) {
      return;
    }

    seq += 1;
    broadcast({ type: 'delta', seq, updates });
    logger.debug('delta broadcast', { seq, updates: updates.length });
  }

  function broadcastHeartbeat(): void {
    seq += 1;
    broadcast({ type: 'heartbeat', seq, serverTime: now() });
  }

  socketServer.on('connection', (socket) => {
    socket.on('error', (error) => {
      logger.error('websocket error', { error: error.message });
    });
    socket.on('close', () => {
      logger.info('client disconnected', { clients: socketServer.clients.size });
    });

    const snapshot: ServerMessage = { type: 'snapshot', seq, nodes: simulation.snapshot() };
    socket.send(JSON.stringify(snapshot));
    logger.info('client connected', { clients: socketServer.clients.size });
  });

  return {
    start: () =>
      new Promise<number>((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(config.port, '0.0.0.0', () => {
          httpServer.off('error', reject);
          timers = [
            setInterval(broadcastDelta, config.tickMs),
            setInterval(broadcastHeartbeat, config.heartbeatMs),
          ];
          const address = httpServer.address();
          if (address === null || typeof address === 'string') {
            reject(new Error('server address is unavailable after listen'));
            return;
          }

          logger.info('server listening', {
            port: address.port,
            nodeCount: config.nodeCount,
            tickMs: config.tickMs,
            seed: config.seed,
          });
          resolve(address.port);
        });
      }),
    stop: () =>
      new Promise<void>((resolve, reject) => {
        for (const timer of timers) {
          clearInterval(timer);
        }
        timers = [];
        for (const socket of socketServer.clients) {
          socket.terminate();
        }
        socketServer.close(() => {
          httpServer.close((error) => {
            if (error === undefined) {
              resolve();
              return;
            }
            reject(error);
          });
          httpServer.closeAllConnections();
        });
      }),
  };
}
