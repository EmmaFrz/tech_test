import type { NodeStatus, NodeTelemetry, ServerMessage } from '@shared/protocol';

import { SELECTORS } from './selectors';

const SERVER_TIME = 1_700_000_000_000;
const HEARTBEAT_MS = 2_000;

interface FakeSocket {
  readonly emit: (message: ServerMessage) => void;
}

let latestSocket: FakeSocket | null = null;
let lastSeq = 0;

function nextSeq(): number {
  lastSeq += 1;
  return lastSeq;
}

function track(socket: FakeSocket): void {
  latestSocket = socket;
}

/** The node at 1-based `position` of `makeFleet`: `node-0001` has the highest latency. */
export function fleetNode(position: number, changes: Partial<NodeTelemetry> = {}): NodeTelemetry {
  return {
    nodeId: `node-${String(position).padStart(4, '0')}`,
    status: 'OK',
    cpuLoad: 40,
    memoryUsage: 50,
    latencyMs: 1_000 - position,
    timestamp: SERVER_TIME,
    ...changes,
  };
}

/** Fleet in descending latency order, so a latency sort keeps the IDs in order. */
export function makeFleet(count: number, status: NodeStatus = 'OK'): NodeTelemetry[] {
  return Array.from({ length: count }, (_, index) => fleetNode(index + 1, { status }));
}

/** A newer sample of the node at `position`, which the client applies as an update. */
export function laterSample(position: number, changes: Partial<NodeTelemetry>): NodeTelemetry {
  return fleetNode(position, { timestamp: SERVER_TIME + 1_000, ...changes });
}

/**
 * Loads the dashboard with a deterministic telemetry source in place of the WebSocket: it sends
 * `nodes` as the snapshot, then only heartbeats until a test emits more.
 */
export function visitWithTelemetry(nodes: readonly NodeTelemetry[]): void {
  cy.visit('/', {
    onBeforeLoad(win) {
      class FakeTelemetrySocket extends win.EventTarget {
        private readonly heartbeat: number;

        constructor() {
          super();
          track(this);
          win.setTimeout(() => {
            this.dispatchEvent(new win.Event('open'));
            this.emit({ type: 'snapshot', seq: nextSeq(), nodes });
          }, 0);
          this.heartbeat = win.setInterval(
            () => this.emit({ type: 'heartbeat', seq: nextSeq(), serverTime: SERVER_TIME }),
            HEARTBEAT_MS,
          );
        }

        emit(message: ServerMessage): void {
          this.dispatchEvent(new win.MessageEvent('message', { data: JSON.stringify(message) }));
        }

        close(): void {
          win.clearInterval(this.heartbeat);
        }
      }

      // Next.js uses another WebSocket for HMR; only the telemetry endpoint is simulated.
      const sockets = new Proxy(win.WebSocket, {
        construct(target, args: readonly unknown[]) {
          const [url] = args;
          if (
            (typeof url === 'string' || url instanceof win.URL) &&
            new win.URL(String(url), win.location.href).pathname === '/ws'
          ) {
            return new FakeTelemetrySocket();
          }
          const socket: unknown = Reflect.construct(target, args);
          if (!(socket instanceof target)) {
            throw new TypeError('WebSocket constructor did not return a socket');
          }
          return socket;
        },
      });
      Object.defineProperty(win, 'WebSocket', { configurable: true, value: sockets });
    },
  });
  cy.get(SELECTORS.nodeRow).should('have.length.greaterThan', 0);
}

export function emitDelta(...updates: readonly NodeTelemetry[]): void {
  cy.then(() => latestSocket?.emit({ type: 'delta', seq: nextSeq(), updates }));
}

export function emitSnapshot(nodes: readonly NodeTelemetry[]): void {
  cy.then(() => latestSocket?.emit({ type: 'snapshot', seq: nextSeq(), nodes }));
}

// Chromium's DevTools protocol, for native input and media emulation that Cypress commands lack.
async function sendDevToolsCommand(command: string, params: object): Promise<void> {
  await Cypress.automation('remote:debugger:protocol', { command, params });
}

/** `cy.press(ENTER)` sends no character, which Chromium needs to activate the focused button. */
export function pressEnter(): void {
  const key = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 };
  cy.then(async () => {
    await sendDevToolsCommand('Input.dispatchKeyEvent', { ...key, type: 'keyDown', text: '\r' });
    await sendDevToolsCommand('Input.dispatchKeyEvent', { ...key, type: 'keyUp' });
  });
}

/** `cy.press` takes no modifiers, so Shift+Tab goes through the DevTools protocol. */
export function pressShiftTab(): void {
  const shiftModifier = 8;
  const shift = { key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 };
  const tab = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: shiftModifier };
  cy.then(async () => {
    await sendDevToolsCommand('Input.dispatchKeyEvent', {
      ...shift,
      type: 'rawKeyDown',
      modifiers: shiftModifier,
    });
    await sendDevToolsCommand('Input.dispatchKeyEvent', { ...tab, type: 'rawKeyDown' });
    await sendDevToolsCommand('Input.dispatchKeyEvent', { ...tab, type: 'keyUp' });
    await sendDevToolsCommand('Input.dispatchKeyEvent', { ...shift, type: 'keyUp', modifiers: 0 });
  });
}

/** Emulates `prefers-reduced-motion: reduce` until `resetReducedMotion` runs. */
export function emulateReducedMotion(): void {
  cy.then(() =>
    sendDevToolsCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    }),
  );
}

export function resetReducedMotion(): void {
  cy.then(() => sendDevToolsCommand('Emulation.setEmulatedMedia', { features: [] }));
}
