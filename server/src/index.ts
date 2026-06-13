import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { RoomManager } from './rooms/RoomManager.js';

const port = Number(process.env.PORT ?? 3001);
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

const httpServer = createServer((request, response) => {
  if (request.url === '/healthz') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, rooms: 'active' }));
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