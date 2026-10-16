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
  const received = [];
  const timeout = setTimeout(() => {
    socket.close();
    reject(new Error('Expected a snapshot followed by a delta within 5 seconds'));
  }, 5_000);

  function finish(error) {
    clearTimeout(timeout);
    socket.close();
    if (error === undefined) {
      resolve();
    } else {
      reject(error);
    }
  }

  socket.addEventListener('error', () => finish(new Error('WebSocket connection failed')), {
    once: true,
  });

  socket.addEventListener('message', (event) => {
    try {
      received.push(JSON.parse(event.data));
      const [snapshot, ...rest] = received;
      assert.equal(snapshot.type, 'snapshot');
      assert.ok(Number.isSafeInteger(snapshot.seq));
      assert.ok(snapshot.nodes.length > 0, 'the snapshot must contain nodes');
      if (rest.some((message) => message.type === 'delta')) {
        assert.ok(rest.every((message) => message.seq > snapshot.seq));
        finish();
      }
    } catch (error) {
      finish(error);
    }
  });
});

process.stdout.write('Application routes, server health and telemetry stream passed.\n');
