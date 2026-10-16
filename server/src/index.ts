import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { RoomManager } from './rooms/RoomManager.js';
import { sanitizeRoomCode } from './protocol/validation.js';

const port = Number(process.env.PORT ?? 3001);

// Comma-separated list of browser origins allowed to talk to this server.
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,https://pongzu.netlify.app')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const httpServer = createServer((request, response) => {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const path = (request.url ?? '/').split('?')[0];

  if (path === '/healthz') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, rooms: roomManager.roomCount }));
    return;
  }

  // Invite-link check: /api/room/CODE/exists
  const roomMatch = /^\/api\/room\/([^/]+)\/exists$/.exec(path);
  if (roomMatch) {
    const status = roomManager.getRoomStatus(sanitizeRoomCode(roomMatch[1]));
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(status));
    return;
  }

  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('Pongzu server is running.');
});

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
  // Notice dead connections quickly so the other player isn't left staring at a frozen ball.
  pingInterval: 2000,
  pingTimeout: 5000,
  // Largest legitimate message is a room create/join carrying a small avatar.
  maxHttpBufferSize: 300_000,
});

const roomManager = new RoomManager(io);

io.on('connection', (socket) => {
  roomManager.registerSocketEvents(socket);

  socket.on('disconnect', () => {
    roomManager.handleDisconnect(socket.id);
  });
});

// Keep serving the other rooms if one request hits an unexpected bug.
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught exception:', error);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});

httpServer.listen(port, () => {
  console.log(`Pongzu server listening on port ${port}`);
  console.log(`Accepting connections from: ${allowedOrigins.join(', ')}`);
});
