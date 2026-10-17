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

// The server sends a heartbeat every 2 s: five missed beats mean the stream is dead even when the
// socket never closes (a half-open connection, or a peer that only sends invalid messages).
export const IDLE_TIMEOUT_MS = 10_000;
// Opening the socket and receiving the first snapshot, which is large for big fleets.
export const FIRST_MESSAGE_TIMEOUT_MS = 15_000;

const log = createLogger('ws');

function isOfflineAfter(failedAttempts: number): boolean {
  return failedAttempts >= OFFLINE_AFTER_FAILED_ATTEMPTS;
}

/**
 * Delay before the next attempt after `failedAttempts` consecutive failures: doubles from 0.5 s
 * while reconnecting and waits the 10 s cap once offline. Jitter of +-20 % keeps clients from
 * retrying in lockstep and never pushes a delay past the cap.
 */
export function computeBackoffDelayMs(failedAttempts: number, random: () => number): number {
  const base = isOfflineAfter(failedAttempts)
    ? MAX_BACKOFF_MS
    : Math.min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * 2 ** (failedAttempts - 1));
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
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
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
    this.clearWatchdog();
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
    this.armWatchdog(FIRST_MESSAGE_TIMEOUT_MS);
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

    this.armWatchdog(IDLE_TIMEOUT_MS);
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
    this.clearWatchdog();
    this.scheduleRetry();
  }

  private handleSilence(timeoutMs: number): void {
    log.warn('no valid telemetry, reconnecting', { timeoutMs });
    this.detachSocket();
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    this.failedAttempts += 1;
    const random = this.options.random ?? Math.random;
    const delayMs = computeBackoffDelayMs(this.failedAttempts, random);
    this.setState(isOfflineAfter(this.failedAttempts) ? 'offline' : 'reconnecting');
    log.info('connection lost, retrying', { attempt: this.failedAttempts, delayMs });
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.openSocket();
    }, delayMs);
  }

  // Only valid messages re-arm the watchdog, and they do so on receipt, not in the animation
  // frame flush, so a background tab whose frames are paused cannot trip it while data arrives.
  // Timer throttling in background tabs can only delay the check, never fire it early.
  private armWatchdog(timeoutMs: number): void {
    this.clearWatchdog();
    this.watchdogTimer = setTimeout(() => {
      this.watchdogTimer = null;
      this.handleSilence(timeoutMs);
    }, timeoutMs);
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer !== null) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
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
