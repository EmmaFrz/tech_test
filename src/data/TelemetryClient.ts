import type { TelemetrySocket } from './socket';

import type { ConnectionState } from '@/domain/connection';
import { assertNever } from '@/lib/assertNever';
import { createLogger } from '@/lib/logger';
import type { NodeTelemetry, ServerMessage } from '@shared/protocol';

import { decodeServerMessage } from './guards';
import { createBrowserSocket } from './socket';

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 10_000;
const JITTER_RATIO = 0.2;
const OFFLINE_AFTER_FAILED_ATTEMPTS = 5;

const log = createLogger('ws');

/** Doubles from 0.5 s up to a 10 s cap; jitter of +-20 % keeps clients from retrying in lockstep. */
export function computeBackoffDelayMs(failedAttempts: number, random: () => number): number {
  const base = Math.min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * 2 ** (failedAttempts - 1));
  const jitter = (random() * 2 - 1) * JITTER_RATIO;
  return Math.min(MAX_BACKOFF_MS, Math.round(base * (1 + jitter)));
}

export interface TelemetryClientOptions {
  readonly url: string;
  readonly onSnapshot: (nodes: readonly NodeTelemetry[]) => void;
  readonly onDelta: (updates: readonly NodeTelemetry[]) => void;
  readonly onHeartbeat: (serverTime: number) => void;
  readonly onStateChange: (state: ConnectionState) => void;
  readonly createSocket?: (url: string) => TelemetrySocket;
  readonly random?: () => number;
}

export class TelemetryClient {
  private readonly options: TelemetryClientOptions;
  private socket: TelemetrySocket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private state: ConnectionState = 'offline';
  private failedAttempts = 0;
  private isStopped = true;
  private invalidMessages = 0;

  constructor(options: TelemetryClientOptions) {
    this.options = options;
  }

  get invalidMessageCount(): number {
    return this.invalidMessages;
  }

  connect(): void {
    if (!this.isStopped) {
      return;
    }

    this.isStopped = false;
    this.failedAttempts = 0;
    this.setState('connecting');
    this.openSocket();
  }

  disconnect(): void {
    this.isStopped = true;
    this.clearRetryTimer();
    this.detachSocket();
    this.setState('offline');
  }

  private openSocket(): void {
    const createSocket = this.options.createSocket ?? createBrowserSocket;
    const socket = createSocket(this.options.url);
    this.socket = socket;

    socket.onopen = () => log.info('socket opened', { url: this.options.url });
    socket.onmessage = (event) => {
      if (socket === this.socket) {
        this.handlePayload(event.data);
      }
    };
    socket.onerror = () => log.debug('socket error');
    socket.onclose = () => {
      if (socket === this.socket) {
        this.handleClose();
      }
    };
  }

  private detachSocket(): void {
    const socket = this.socket;
    this.socket = null;
    if (socket === null) {
      return;
    }

    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    socket.close();
  }

  private handlePayload(raw: unknown): void {
    let message: ServerMessage;
    try {
      message = decodeServerMessage(raw);
    } catch (error) {
      this.invalidMessages += 1;
      log.warn('invalid message dropped', {
        reason: error instanceof Error ? error.message : String(error),
        total: this.invalidMessages,
      });
      return;
    }

    this.failedAttempts = 0;
    this.setState('live');

    switch (message.type) {
      case 'snapshot':
        this.options.onSnapshot(message.nodes);
        return;
      case 'delta':
        this.options.onDelta(message.updates);
        return;
      case 'heartbeat':
        this.options.onHeartbeat(message.serverTime);
        return;
      default:
        assertNever(message);
    }
  }

  private handleClose(): void {
    this.socket = null;
    this.failedAttempts += 1;
    const random = this.options.random ?? Math.random;
    const delayMs = computeBackoffDelayMs(this.failedAttempts, random);
    this.setState(this.failedAttempts > OFFLINE_AFTER_FAILED_ATTEMPTS ? 'offline' : 'reconnecting');
    log.info('connection lost, retrying', { attempt: this.failedAttempts, delayMs });
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.openSocket();
    }, delayMs);
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private setState(state: ConnectionState): void {
    if (state === this.state) {
      return;
    }

    this.state = state;
    this.options.onStateChange(state);
  }
}
