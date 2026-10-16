import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// Recreates the mock-server container on a new IP address while nginx keeps running, then checks
// that a client already connected through nginx reconnects and receives a fresh snapshot without
// an nginx reload. Works on the Compose project of the current directory, whose stack must be up.

const [composeBinary = 'docker', ...composeArgs] = (
  process.env['COMPOSE_COMMAND'] ?? 'docker compose'
).split(' ');
const baseUrl = process.env['STACK_URL'] ?? 'http://localhost:3000';
const healthUrl = process.env['HEALTH_URL'] ?? 'http://localhost:4000/health';
const TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 500;
const MAX_REPLACEMENTS = 3;

const execFileAsync = promisify(execFile);

// Asynchronous on purpose: the client's socket events must be handled while Docker works, or a
// late message from the old backend could be counted after the baseline below.
async function run(binary, args) {
  const { stdout } = await execFileAsync(binary, args, { encoding: 'utf8' });
  return stdout.trim();
}

function compose(...args) {
  return run(composeBinary, [...composeArgs, ...args]);
}

async function inspect(containerId) {
  const [details] = JSON.parse(await run('docker', ['inspect', containerId]));
  const [[network, settings]] = Object.entries(details.NetworkSettings.Networks);
  return { image: details.Image, network, ip: settings.IPAddress };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(description, condition) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${description}`);
    }
    await sleep(RETRY_DELAY_MS);
  }
}

async function isHealthy() {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

/** Reconnects after every close, like the dashboard, and counts the snapshots it receives. */
function connectThroughProxy() {
  const socketUrl = new URL('/ws', baseUrl);
  socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const client = { snapshots: 0, isStopped: false, socket: null };

  function open() {
    if (client.isStopped) {
      return;
    }
    const socket = new WebSocket(socketUrl);
    client.socket = socket;
    socket.addEventListener('message', (event) => {
      if (JSON.parse(event.data).type === 'snapshot') {
        client.snapshots += 1;
      }
    });
    socket.addEventListener('close', () => setTimeout(open, RETRY_DELAY_MS));
  }

  open();
  return {
    snapshots: () => client.snapshots,
    stop: () => {
      client.isStopped = true;
      client.socket?.close();
    },
  };
}

/** Holds the lowest free address on the network, so the next container cannot take it. */
function holdAddress(network, image) {
  return run('docker', [
    'run',
    '--detach',
    '--rm',
    '--network',
    network,
    '--entrypoint',
    'node',
    image,
    '--eval',
    'setInterval(() => {}, 1 << 30)',
  ]);
}

const webId = await compose('ps', '-q', 'web');
const original = await inspect(await compose('ps', '-q', 'mock-server'));
const client = connectThroughProxy();
const placeholders = [];

try {
  await waitFor('a first snapshot through nginx', () => client.snapshots() > 0);

  // Recreate the backend until it lands on a new address; each round holds one more free address.
  let replacement = original;
  let snapshotsBefore = 0;
  for (let round = 1; round <= MAX_REPLACEMENTS && replacement.ip === original.ip; round += 1) {
    await compose('stop', 'mock-server');
    await compose('rm', '-f', 'mock-server');
    placeholders.push(await holdAddress(original.network, original.image));
    snapshotsBefore = client.snapshots();
    await compose('up', '--detach', '--no-deps', '--no-build', 'mock-server');
    await waitFor('the recreated backend to be healthy', isHealthy);
    replacement = await inspect(await compose('ps', '-q', 'mock-server'));
  }
  assert.notEqual(replacement.ip, original.ip, 'the backend must come back on a new address');

  await waitFor('a fresh snapshot through nginx', () => client.snapshots() > snapshotsBefore);
  assert.equal(await compose('ps', '-q', 'web'), webId, 'nginx must keep running, not restart');

  process.stdout.write(
    `Backend moved from ${original.ip} to ${replacement.ip}; the proxied client reconnected.\n`,
  );
} finally {
  client.stop();
  for (const placeholderId of placeholders) {
    await run('docker', ['rm', '--force', placeholderId]);
  }
}
