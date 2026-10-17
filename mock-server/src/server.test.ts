// @vitest-environment node
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import type { TelemetryServer } from './server.js';
import type { Server } from 'node:http';
import type { RawData } from 'ws';

import type { ServerMessage } from '@shared/protocol.js';

import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createTelemetryServer } from './server.js';

const NODE_COUNT = 20;
const MOCK_SERVER_DIRECTORY = fileURLToPath(new URL('..', import.meta.url));
const SUBPROCESS_TIMEOUT_MS = 15_000;

let runningServer: TelemetryServer | undefined;
let occupiedPort: Server | undefined;
const openSockets: WebSocket[] = [];

async function occupyPort(): Promise<number> {
  const server = createServer();
  occupiedPort = server;
  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('The occupying server has no port');
  }
  return address.port;
}

interface ProcessResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs TypeScript through tsx, as `npm run dev:mock` does, in the mock server directory. */
function runNode(args: readonly string[], env: NodeJS.ProcessEnv): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', ...args], {
      cwd: MOCK_SERVER_DIRECTORY,
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Process did not exit within ${SUBPROCESS_TIMEOUT_MS} ms: ${stderr}`));
    }, SUBPROCESS_TIMEOUT_MS);
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

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
  const occupier = occupiedPort;
  occupiedPort = undefined;
  if (occupier !== undefined) {
    await new Promise((resolve) => occupier.close(resolve));
  }
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

describe('telemetry server on a port that is already taken', () => {
  it('rejects start instead of throwing an unhandled error', async () => {
    const port = await occupyPort();
    const server = createTelemetryServer({
      config: { ...loadConfig({}), port },
      logger: createLogger('error', () => undefined),
    });

    await expect(server.start()).rejects.toThrow(/EADDRINUSE/);
  });

  it('makes the entry point log a structured startup failure and exit with 1', async () => {
    const port = await occupyPort();

    const result = await runNode(['src/index.ts'], { PORT: String(port), LOG_LEVEL: 'info' });

    expect(result.code).toBe(1);
    expect(result.stderr).not.toMatch(/Unhandled 'error' event/);
    const failure = result.stdout.split('\n').find((line) => line.includes('"startup failed"'));
    expect(JSON.parse(failure ?? '{}')).toMatchObject({
      level: 'error',
      message: 'startup failed',
    });
    expect(failure).toContain('EADDRINUSE');
  }, 20_000);

  it('leaves nothing running that would keep the process alive', async () => {
    const port = await occupyPort();
    const script = [
      "import { loadConfig } from './src/config.ts';",
      "import { createLogger } from './src/logger.ts';",
      "import { createTelemetryServer } from './src/server.ts';",
      'const config = { ...loadConfig({}), port: Number(process.env.PORT) };',
      "const server = createTelemetryServer({ config, logger: createLogger('error') });",
      'server.start().then(',
      "  () => process.stdout.write('started\\n'),",
      '  () => { process.exitCode = 7; },',
      ');',
    ].join('\n');

    const result = await runNode(['--input-type=module', '--eval', script], {
      PORT: String(port),
    });

    expect(result.code).toBe(7);
    expect(result.stdout).not.toContain('started');
  }, 20_000);
});
