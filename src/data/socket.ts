/** The subset of WebSocket the client relies on, so tests can substitute a fake. */
export interface TelemetrySocket {
  onopen: (() => void) | null;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  close: () => void;
}

export function createBrowserSocket(url: string): TelemetrySocket {
  const socket = new WebSocket(url);
  const adapter: TelemetrySocket = {
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    close: () => socket.close(),
  };

  socket.addEventListener('open', () => adapter.onopen?.());
  socket.addEventListener('message', (event: MessageEvent<unknown>) =>
    adapter.onmessage?.({ data: event.data }),
  );
  socket.addEventListener('error', () => adapter.onerror?.());
  socket.addEventListener('close', () => adapter.onclose?.());

  return adapter;
}
