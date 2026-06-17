import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { RoomManager } from './rooms/RoomManager.js';

const port = Number(process.env.PORT ?? 3001);
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

const httpServer = createServer((request, response) => {
  // CORS headers
  response.setHeader('Access-Control-Allow-Origin', clientOrigin);
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.url === '/healthz') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, rooms: 'active' }));
    return;
  }

  // Room exists API
  if (request.url?.startsWith('/api/room/') && request.url.endsWith('/exists')) {
    const parts = request.url.split('/');
    const code = parts[3]?.toUpperCase(); // /api/room/CODE/exists
    const exists = code ? roomManager.getRoomByToken(code) !== null || roomManager.hasRoom(code) : false;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ exists }));
    return;
  }

  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('Face Pong server is running.');
});

const io = new Server(httpServer, {
  cors: {
    origin: clientOrigin,
    methods: ['GET', 'POST'],
  },
  // Tune for low-latency game traffic
  pingInterval: 5000,
  pingTimeout: 10000,
});

const roomManager = new RoomManager(io);

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  roomManager.registerSocketEvents(socket);

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
    roomManager.handleDisconnect(socket.id);
  });
});

httpServer.listen(port, () => {
  console.log(`Face Pong server listening on http://localhost:${port}`);
  console.log(`Accepting connections from: ${clientOrigin}`);
});