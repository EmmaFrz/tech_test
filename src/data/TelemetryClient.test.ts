import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectionState } from '@/domain/connection';
import { makeNode } from '@/test/factories';
import { MockWebSocket } from '@/test/MockWebSocket';
import type { NodeTelemetry } from '@shared/protocol';

import {
  computeBackoffDelayMs,
  FIRST_MESSAGE_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  TelemetryClient,
} from './TelemetryClient';

const NO_JITTER = (): number => 0.5;

interface Recorder {
  readonly states: ConnectionState[];
  readonly snapshots: (readonly NodeTelemetry[])[];
  readonly deltas: (readonly NodeTelemetry[])[];
  readonly heartbeats: number[];
}

function createClient(): { readonly client: TelemetryClient; readonly recorder: Recorder } {
  const recorder: Recorder = { states: [], snapshots: [], deltas: [], heartbeats: [] };
  const client = new TelemetryClient({
    url: 'ws://localhost:3000/ws',
    createSocket: MockWebSocket.create,
    random: NO_JITTER,
    onStateChange: (state) => recorder.states.push(state),
    onSnapshot: (nodes) => recorder.snapshots.push(nodes),
    onDelta: (updates) => recorder.deltas.push(updates),
    onHeartbeat: (serverTime) => recorder.heartbeats.push(serverTime),
  });
  return { client, recorder };
}

describe('computeBackoffDelayMs', () => {
  it('doubles from 0.5 s, then waits the 10 s cap once five attempts have failed', () => {
    const delays = [1, 2, 3, 4, 5, 6, 7].map((attempt) =>
      computeBackoffDelayMs(attempt, NO_JITTER),
    );

    expect(delays).toEqual([500, 1_000, 2_000, 4_000, 10_000, 10_000, 10_000]);
  });

  it('spreads delays by up to 20 percent and never exceeds the cap', () => {
    expect(computeBackoffDelayMs(1, () => 0)).toBe(400);
    expect(computeBackoffDelayMs(1, () => 1)).toBe(600);
    expect(computeBackoffDelayMs(5, () => 0)).toBe(8_000);
    expect(computeBackoffDelayMs(6, () => 1)).toBe(10_000);
  });
});

describe('TelemetryClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects to the configured URL and reports the connecting state', () => {
    const { client, recorder } = createClient();

    client.connect();

    expect(MockWebSocket.latest().url).toBe('ws://localhost:3000/ws');
    expect(recorder.states).toEqual(['connecting']);
  });

  it('becomes live on the first valid message and routes each message type', () => {
    const { client, recorder } = createClient();
    client.connect();
    const socket = MockWebSocket.latest();
    const node = makeNode();

    socket.simulateOpen();
    socket.simulateMessage({ type: 'snapshot', seq: 1, nodes: [node] });
    socket.simulateMessage({ type: 'delta', seq: 2, updates: [node] });
    socket.simulateMessage({ type: 'heartbeat', seq: 3, serverTime: 99 });

    expect(recorder.states).toEqual(['connecting', 'live']);
    expect(recorder.snapshots).toEqual([[node]]);
    expect(recorder.deltas).toEqual([[node]]);
    expect(recorder.heartbeats).toEqual([99]);
  });

  it('drops and counts invalid messages without changing the connection state', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { client, recorder } = createClient();
    client.connect();
    const socket = MockWebSocket.latest();

    socket.simulateMessage('{broken');
    socket.simulateMessage({ type: 'delta', seq: 1 });

    expect(client.invalidMessageCount).toBe(2);
    expect(recorder.deltas).toHaveLength(0);
    expect(recorder.states).toEqual(['connecting']);
  });

  it('drops and counts a heartbeat whose server time is out of range', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { client, recorder } = createClient();
    client.connect();

    MockWebSocket.latest().simulateMessage({ type: 'heartbeat', seq: 1, serverTime: 1e100 });

    expect(client.invalidMessageCount).toBe(1);
    expect(recorder.heartbeats).toEqual([]);
  });

  it('reconnects with exponential backoff after the socket closes', () => {
    const { client, recorder } = createClient();
    client.connect();

    MockWebSocket.latest().simulateClose();
    expect(recorder.states).toEqual(['connecting', 'reconnecting']);
    expect(MockWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(499);
    expect(MockWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(2);

    MockWebSocket.latest().simulateClose();
    vi.advanceTimersByTime(999);
    expect(MockWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it('resets the backoff after a successful message', () => {
    const { client } = createClient();
    client.connect();
    MockWebSocket.latest().simulateClose();
    vi.advanceTimersByTime(500);
    MockWebSocket.latest().simulateClose();
    vi.advanceTimersByTime(1_000);

    MockWebSocket.latest().simulateMessage({ type: 'heartbeat', seq: 1, serverTime: 1 });
    MockWebSocket.latest().simulateClose();

    vi.advanceTimersByTime(500);
    expect(MockWebSocket.instances).toHaveLength(4);
  });

  it('reports offline after repeated failures while it keeps retrying', () => {
    const { client, recorder } = createClient();
    client.connect();

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      MockWebSocket.latest().simulateClose();
      vi.advanceTimersByTime(10_000);
    }

    expect(recorder.states.at(-1)).toBe('offline');
    expect(MockWebSocket.instances).toHaveLength(7);
  });

  it('goes offline on the fifth consecutive failure and retries at the cap from then on', () => {
    const { client, recorder } = createClient();
    client.connect();
    for (const delayMs of [500, 1_000, 2_000]) {
      MockWebSocket.latest().simulateClose();
      vi.advanceTimersByTime(delayMs);
    }

    MockWebSocket.latest().simulateClose();
    expect(recorder.states.at(-1)).toBe('reconnecting');
    vi.advanceTimersByTime(3_999);
    expect(MockWebSocket.instances).toHaveLength(4);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(5);

    MockWebSocket.latest().simulateClose();
    expect(recorder.states.at(-1)).toBe('offline');
    vi.advanceTimersByTime(9_999);
    expect(MockWebSocket.instances).toHaveLength(5);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(6);

    MockWebSocket.latest().simulateClose();
    expect(recorder.states.at(-1)).toBe('offline');
    vi.advanceTimersByTime(10_000);
    expect(MockWebSocket.instances).toHaveLength(7);

    MockWebSocket.latest().simulateMessage({ type: 'heartbeat', seq: 1, serverTime: 1 });
    expect(recorder.states.at(-1)).toBe('live');
    MockWebSocket.latest().simulateClose();
    expect(recorder.states.at(-1)).toBe('reconnecting');
    vi.advanceTimersByTime(500);
    expect(MockWebSocket.instances).toHaveLength(8);
  });

  it('returns to live when a retry succeeds', () => {
    const { client, recorder } = createClient();
    client.connect();
    MockWebSocket.latest().simulateMessage({ type: 'heartbeat', seq: 1, serverTime: 1 });
    MockWebSocket.latest().simulateClose();
    vi.advanceTimersByTime(500);

    MockWebSocket.latest().simulateMessage({ type: 'heartbeat', seq: 2, serverTime: 2 });

    expect(recorder.states).toEqual(['connecting', 'live', 'reconnecting', 'live']);
  });

  it('stops retrying and closes the socket when disconnected', () => {
    const { client, recorder } = createClient();
    client.connect();
    const socket = MockWebSocket.latest();
    socket.simulateClose();

    client.disconnect();
    vi.advanceTimersByTime(60_000);

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(recorder.states.at(-1)).toBe('offline');
  });

  it('ignores events from a socket that was already replaced', () => {
    const { client, recorder } = createClient();
    client.connect();
    const first = MockWebSocket.latest();
    first.simulateClose();
    vi.advanceTimersByTime(500);

    first.simulateMessage({ type: 'delta', seq: 1, updates: [makeNode()] });
    first.simulateClose();

    expect(recorder.deltas).toHaveLength(0);
    vi.advanceTimersByTime(FIRST_MESSAGE_TIMEOUT_MS - 1);
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('closes the underlying socket on disconnect', () => {
    const { client } = createClient();
    client.connect();
    const socket = MockWebSocket.latest();

    client.disconnect();

    expect(socket.isClosed).toBe(true);
  });

  it('ignores a second connect call while already started', () => {
    const { client } = createClient();

    client.connect();
    client.connect();

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  describe('silence watchdog', () => {
    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    it('closes and replaces a socket that never delivers a first message', () => {
      const { client, recorder } = createClient();
      client.connect();
      const socket = MockWebSocket.latest();
      socket.simulateOpen();

      vi.advanceTimersByTime(FIRST_MESSAGE_TIMEOUT_MS - 1);
      expect(socket.isClosed).toBe(false);
      vi.advanceTimersByTime(1);

      expect(socket.isClosed).toBe(true);
      expect(recorder.states).toEqual(['connecting', 'reconnecting']);
      vi.advanceTimersByTime(500);
      expect(MockWebSocket.instances).toHaveLength(2);
    });

    it('reconnects when a live stream stops sending heartbeats without closing', () => {
      const { client, recorder } = createClient();
      client.connect();
      const socket = MockWebSocket.latest();
      socket.simulateMessage({ type: 'snapshot', seq: 1, nodes: [makeNode()] });

      vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1);
      expect(recorder.states.at(-1)).toBe('live');
      vi.advanceTimersByTime(1);

      expect(socket.isClosed).toBe(true);
      expect(recorder.states.at(-1)).toBe('reconnecting');
      vi.advanceTimersByTime(500);
      expect(MockWebSocket.instances).toHaveLength(2);
    });

    it('treats a stream of invalid messages as silence', () => {
      const { client, recorder } = createClient();
      client.connect();
      const socket = MockWebSocket.latest();
      socket.simulateMessage({ type: 'snapshot', seq: 1, nodes: [makeNode()] });

      for (let second = 1; second <= IDLE_TIMEOUT_MS / 1_000; second += 1) {
        vi.advanceTimersByTime(1_000);
        socket.simulateMessage({ type: 'heartbeat', seq: second + 1, serverTime: 1e100 });
      }

      expect(client.invalidMessageCount).toBeGreaterThan(0);
      expect(socket.isClosed).toBe(true);
      expect(recorder.states.at(-1)).toBe('reconnecting');
    });

    it('keeps a healthy stream open, including after a reconnect', () => {
      const { client, recorder } = createClient();
      client.connect();
      MockWebSocket.latest().simulateClose();
      vi.advanceTimersByTime(500);
      const socket = MockWebSocket.latest();
      socket.simulateMessage({ type: 'snapshot', seq: 1, nodes: [makeNode()] });

      for (let beat = 1; beat <= 60; beat += 1) {
        vi.advanceTimersByTime(2_000);
        socket.simulateMessage({ type: 'heartbeat', seq: beat + 1, serverTime: beat });
      }

      expect(socket.isClosed).toBe(false);
      expect(MockWebSocket.instances).toHaveLength(2);
      expect(recorder.states).toEqual(['connecting', 'reconnecting', 'live']);
    });

    it('schedules exactly one retry when the replaced socket closes late', () => {
      const { client } = createClient();
      client.connect();
      const silent = MockWebSocket.latest();
      silent.simulateMessage({ type: 'snapshot', seq: 1, nodes: [makeNode()] });
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS);

      silent.simulateClose();
      vi.advanceTimersByTime(500);

      expect(MockWebSocket.instances).toHaveLength(2);
      vi.advanceTimersByTime(1_000);
      expect(MockWebSocket.instances).toHaveLength(2);
    });

    it('stops watching once the socket closes or the client disconnects', () => {
      const { client } = createClient();
      client.connect();
      MockWebSocket.latest().simulateClose();
      vi.advanceTimersByTime(500);

      client.disconnect();
      vi.advanceTimersByTime(FIRST_MESSAGE_TIMEOUT_MS * 4);

      expect(MockWebSocket.instances).toHaveLength(2);
    });
  });
});
