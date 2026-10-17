// @vitest-environment node
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { connectThroughProxy } from './proxyClient.mjs';

const RETRY_DELAY_MS = 10;
const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const SNAPSHOT = Buffer.from(JSON.stringify({ type: 'snapshot', seq: 1, nodes: [] }));

let proxy;
let client;

function acceptUpgrade(request, socket) {
  const accept = createHash('sha1')
    .update(`${request.headers['sec-websocket-key']}${WEBSOCKET_GUID}`)
    .digest('base64');
  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '\r\n',
    ].join('\r\n'),
  );
  // One unmasked text frame; the payload is shorter than 126 bytes.
  socket.write(Buffer.concat([Buffer.from([0x81, SNAPSHOT.length]), SNAPSHOT]));
}

/**
 * Answers each upgrade with the next planned outcome, then accepts: `reject` is the 502 nginx
 * returns while the backend is away, `drop` sends a snapshot and hangs up as a stopped backend.
 */
async function startProxy(plan) {
  const server = createServer();
  const state = { upgrades: 0, server, sockets: new Set() };
  server.on('upgrade', (request, socket) => {
    const outcome = plan[state.upgrades] ?? 'accept';
    state.upgrades += 1;
    state.sockets.add(socket);
    // A stopped client aborts its handshake, which resets the connection on this side.
    socket.on('error', () => socket.destroy());
    if (outcome === 'reject') {
      socket.end('HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n');
      return;
    }
    acceptUpgrade(request, socket);
    if (outcome === 'drop') {
      socket.end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  proxy = state;
  return `http://127.0.0.1:${server.address().port}`;
}

afterEach(async () => {
  client?.stop();
  client = undefined;
  if (proxy !== undefined) {
    for (const socket of proxy.sockets) {
      socket.destroy();
    }
    proxy.server.closeAllConnections();
    await new Promise((resolve) => proxy.server.close(resolve));
    proxy = undefined;
  }
});

describe('connectThroughProxy', () => {
  it('reconnects through rejected handshakes until the backend answers again', async () => {
    const baseUrl = await startProxy(['drop', 'reject', 'reject']);

    client = connectThroughProxy(baseUrl, RETRY_DELAY_MS);

    await vi.waitFor(() => expect(client.snapshots()).toBe(2));
    expect(client.attempts()).toBe(4);
    expect(proxy.upgrades).toBe(4);
  });

  it('opens one socket per failure when a rejection reports both error and close', async () => {
    const baseUrl = await startProxy(['reject', 'reject', 'reject', 'reject']);

    client = connectThroughProxy(baseUrl, RETRY_DELAY_MS);

    await vi.waitFor(() => expect(client.snapshots()).toBe(1));
    expect(client.attempts()).toBe(5);
  });

  it('cancels the pending retry when stopped', async () => {
    const baseUrl = await startProxy(Array.from({ length: 1_000 }, () => 'reject'));
    client = connectThroughProxy(baseUrl, RETRY_DELAY_MS);
    await vi.waitFor(() => expect(proxy.upgrades).toBeGreaterThanOrEqual(2));

    client.stop();
    const attemptsWhenStopped = client.attempts();
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * 10));

    expect(client.attempts()).toBe(attemptsWhenStopped);
  });
});
