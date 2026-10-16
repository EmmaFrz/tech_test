import type { TelemetrySocket } from '@/data/socket';

/** Test double that records every socket the client opens and lets tests drive its events. */
export class MockWebSocket implements TelemetrySocket {
  static readonly instances: MockWebSocket[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: { readonly data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  isClosed = false;

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  static reset(): void {
    MockWebSocket.instances.length = 0;
  }

  static readonly create = (url: string): MockWebSocket => new MockWebSocket(url);

  static latest(): MockWebSocket {
    const latest = MockWebSocket.instances.at(-1);
    if (latest === undefined) {
      throw new Error('No MockWebSocket has been created');
    }
    return latest;
  }

  close(): void {
    this.isClosed = true;
  }

  simulateOpen(): void {
    this.onopen?.();
  }

  /** Objects are serialized like the real server does; strings are sent as is. */
  simulateMessage(payload: unknown): void {
    this.onmessage?.({ data: typeof payload === 'string' ? payload : JSON.stringify(payload) });
  }

  simulateClose(): void {
    this.onclose?.();
  }
}
