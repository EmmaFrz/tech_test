/**
 * Connects to the stack's `/ws` endpoint and, like the dashboard, opens a new socket after every
 * failed or closed one. Counts the connection attempts and the snapshots received.
 */
export function connectThroughProxy(baseUrl, retryDelayMs) {
  const socketUrl = new URL('/ws', baseUrl);
  socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const client = { attempts: 0, snapshots: 0, isStopped: false, socket: null, retryTimer: null };

  function open() {
    client.retryTimer = null;
    if (client.isStopped) {
      return;
    }

    const socket = new WebSocket(socketUrl);
    let hasScheduledRetry = false;
    // Node 22 reports a rejected handshake (a 502 while the backend is away) with `error` alone;
    // later versions follow it with `close`. Either event retries, once per socket.
    function retry() {
      if (hasScheduledRetry || client.isStopped) {
        return;
      }
      hasScheduledRetry = true;
      client.retryTimer = setTimeout(open, retryDelayMs);
    }

    client.attempts += 1;
    client.socket = socket;
    socket.addEventListener('message', (event) => {
      if (JSON.parse(event.data).type === 'snapshot') {
        client.snapshots += 1;
      }
    });
    socket.addEventListener('error', retry);
    socket.addEventListener('close', retry);
  }

  open();
  return {
    attempts: () => client.attempts,
    snapshots: () => client.snapshots,
    stop: () => {
      client.isStopped = true;
      clearTimeout(client.retryTimer);
      client.socket?.close();
    },
  };
}
