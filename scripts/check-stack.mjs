import assert from 'node:assert/strict';

const baseUrl = process.env['STACK_URL'] ?? 'http://localhost:3000';
const healthUrl = process.env['HEALTH_URL'] ?? 'http://localhost:4000/health';

for (const path of ['/', '/nodes/node-0042']) {
  const response = await fetch(new URL(path, baseUrl), { signal: AbortSignal.timeout(5_000) });
  assert.equal(response.status, 200, `${path} must be served`);
  assert.match(await response.text(), /<title>Fleet Ops<\/title>/);
}

const health = await fetch(healthUrl, { signal: AbortSignal.timeout(5_000) });
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { status: 'ok' });

const socketUrl = new URL('/ws', baseUrl);
socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(socketUrl);

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    socket.close();
    reject(new Error('WebSocket snapshot timed out'));
  }, 5_000);

  socket.addEventListener(
    'error',
    () => {
      clearTimeout(timeout);
      reject(new Error('WebSocket connection failed'));
    },
    { once: true },
  );

  socket.addEventListener(
    'message',
    (event) => {
      clearTimeout(timeout);
      try {
        const message = JSON.parse(event.data);
        assert.equal(message.type, 'snapshot');
        assert.ok(Number.isSafeInteger(message.seq));
        assert.ok(Array.isArray(message.nodes));
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        socket.close();
      }
    },
    { once: true },
  );
});

process.stdout.write('Application routes, server health and WebSocket proxy passed.\n');
