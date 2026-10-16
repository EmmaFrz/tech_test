import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBrowserSocket } from './socket';

class FakeBrowserWebSocket extends EventTarget {
  static latest: FakeBrowserWebSocket | null = null;

  readonly close = vi.fn();

  constructor(readonly url: string) {
    super();
    FakeBrowserWebSocket.latest = this;
  }

  static current(): FakeBrowserWebSocket {
    if (FakeBrowserWebSocket.latest === null) {
      throw new Error('No WebSocket has been created');
    }
    return FakeBrowserWebSocket.latest;
  }
}

describe('createBrowserSocket', () => {
  beforeEach(() => {
    FakeBrowserWebSocket.latest = null;
    vi.stubGlobal('WebSocket', FakeBrowserWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens a WebSocket for the given URL', () => {
    createBrowserSocket('ws://localhost:3000/ws');

    expect(FakeBrowserWebSocket.current().url).toBe('ws://localhost:3000/ws');
  });

  it('forwards open, message, error and close events to the assigned handlers', () => {
    const socket = createBrowserSocket('ws://localhost:3000/ws');
    const events: string[] = [];
    socket.onopen = () => events.push('open');
    socket.onmessage = (event) => events.push(`message:${String(event.data)}`);
    socket.onerror = () => events.push('error');
    socket.onclose = () => events.push('close');
    const native = FakeBrowserWebSocket.current();

    native.dispatchEvent(new Event('open'));
    native.dispatchEvent(new MessageEvent('message', { data: 'hello' }));
    native.dispatchEvent(new Event('error'));
    native.dispatchEvent(new Event('close'));

    expect(events).toEqual(['open', 'message:hello', 'error', 'close']);
  });

  it('does nothing when an event arrives and no handler is assigned', () => {
    createBrowserSocket('ws://localhost:3000/ws');

    expect(() => FakeBrowserWebSocket.current().dispatchEvent(new Event('open'))).not.toThrow();
  });

  it('closes the underlying WebSocket', () => {
    const socket = createBrowserSocket('ws://localhost:3000/ws');

    socket.close();

    expect(FakeBrowserWebSocket.current().close).toHaveBeenCalledTimes(1);
  });
});
