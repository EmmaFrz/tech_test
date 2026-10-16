import { createServer } from 'node:http';

import { WebSocketServer } from 'ws';

import type { ServerMessage } from '@shared/protocol.js';

const port = Number(process.env['PORT'] ?? 4000);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not found' }));
});

const socketServer = new WebSocketServer({ server, path: '/ws' });

socketServer.on('connection', (socket) => {
  socket.on('error', (error) => {
    process.stderr.write(
      `${JSON.stringify({ level: 'error', message: 'websocket error', error: error.message })}\n`,
    );
  });
  const snapshot: ServerMessage = { type: 'snapshot', seq: 0, nodes: [] };
  socket.send(JSON.stringify(snapshot));
});

function shutdown(): void {
  for (const socket of socketServer.clients) {
    socket.terminate();
  }

  socketServer.close();
  server.close();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

server.listen(port, '0.0.0.0');
