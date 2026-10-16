// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import type { TelemetryServer } from './server.js';
import type { RawData } from 'ws';

import type { ServerMessage } from '@shared/protocol.js';

import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createTelemetryServer } from './server.js';

const NODE_COUNT = 20;

let runningServer: TelemetryServer | undefined;
const openSockets: WebSocket[] = [];

async function startServer(): Promise<number> {
  const config = {
    ...loadConfig({}),
    port: 0,
    nodeCount: NODE_COUNT,
    tickMs: 10,
    updateRatio: 1,
    heartbeatMs: 25,
  };
  runningServer = createTelemetryServer({ config, logger: createLogger('error', () => undefined) });
  return runningServer.start();
}

function collectMessages(port: number, count: number): Promise<readonly ServerMessage[]> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    openSockets.push(socket);
    const messages: ServerMessage[] = [];

    socket.on('error', reject);
    socket.on('message', (data) => {
      const parsed: unknown = JSON.parse(decode(data));
      if (isServerMessage(parsed)) {
        messages.push(parsed);
      }
      if (messages.length === count) {
        resolve(messages);
      }
    });
  });
}

function decode(data: RawData): string {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString();
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString();
  }

  return data.toString();
}

function isServerMessage(value: unknown): value is ServerMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value.type === 'snapshot' || value.type === 'delta' || value.type === 'heartbeat')
  );
}

afterEach(async () => {
  for (const socket of openSockets.splice(0)) {
    socket.terminate();
  }
  await runningServer?.stop();
  runningServer = undefined;
});

describe('telemetry server', () => {
  it('answers the health check', async () => {
    const port = await startServer();

    const response = await fetch(`http://127.0.0.1:${port}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('answers unknown paths with 404', async () => {
    const port = await startServer();

    const response = await fetch(`http://127.0.0.1:${port}/missing`);

    expect(response.status).toBe(404);
  });

  it('sends a full snapshot as the first message', async () => {
    const port = await startServer();

    const [first] = await collectMessages(port, 1);

    expect(first?.type).toBe('snapshot');
    expect(first?.type === 'snapshot' ? first.nodes : []).toHaveLength(NODE_COUNT);
  });

  it('streams deltas and heartbeats with increasing sequence numbers', async () => {
    const port = await startServer();

    const messages = await collectMessages(port, 10);

    const types = new Set(messages.map((message) => message.type));
    const sequences = messages.map((message) => message.seq);
    expect(types).toEqual(new Set(['snapshot', 'delta', 'heartbeat']));
    expect(sequences).toEqual([...sequences].sort((left, right) => left - right));
    expect(new Set(sequences.slice(1)).size).toBe(sequences.length - 1);
  });
});
