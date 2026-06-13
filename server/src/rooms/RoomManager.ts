import type { Server, Socket } from 'socket.io';
import { Room } from './Room.js';
import { generateRoomCode } from '../protocol/roomCode.js';
import { SERVER_EVENTS, CLIENT_EVENTS } from '../protocol/events.js';

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  /** Map from socketId → room code for fast lookup on disconnect */
  private readonly socketToRoom = new Map<string, string>();
  private readonly io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  createRoom(socket: Socket, playerName: string, avatarDataUrl: string | null): Room {
    // Generate a unique code
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }

    const room = new Room(code, this.io, (c) => this.destroyRoom(c));
    room.addHost(socket, playerName, avatarDataUrl);
    this.rooms.set(code, room);
    this.socketToRoom.set(socket.id, code);

    console.log(`[Room ${code}] Created by ${playerName} (${socket.id})`);

    socket.emit(SERVER_EVENTS.ROOM_CREATED, { code, role: 'host' });
    return room;
  }

  joinRoom(socket: Socket, code: string, playerName: string, avatarDataUrl: string | null): void {
    const upperCode = code.toUpperCase().trim();
    const room = this.rooms.get(upperCode);

    if (!room) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, { message: 'Room not found. Check your code and try again.' });
      return;
    }

    if (room.isFull()) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, { message: 'Room is full.' });
      return;
    }

    room.addGuest(socket, playerName, avatarDataUrl);
    this.socketToRoom.set(socket.id, upperCode);

    console.log(`[Room ${upperCode}] ${playerName} joined as guest (${socket.id})`);

    // Notify guest
    socket.emit(SERVER_EVENTS.ROOM_JOINED, {
      code: upperCode,
      role: 'guest',
      opponentName: room.host?.playerName ?? 'Host',
      opponentAvatarUrl: room.host?.avatarDataUrl ?? null,
    });

    // Notify host
    if (room.host) {
      this.io.to(room.host.socketId).emit(SERVER_EVENTS.ROOM_OPPONENT_JOINED, {
        opponentName: playerName,
        opponentAvatarUrl: avatarDataUrl,
      });
    }
  }

  getRoomBySocket(socketId: string): Room | null {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;
    return this.rooms.get(code) ?? null;
  }

  destroyRoom(code: string) {
    const room = this.rooms.get(code);
    if (!room) return;

    // Clean up socket-to-room mappings
    if (room.host) this.socketToRoom.delete(room.host.socketId);
    if (room.guest) this.socketToRoom.delete(room.guest.socketId);

    this.rooms.delete(code);
    console.log(`[Room ${code}] Destroyed`);
  }

  handleDisconnect(socketId: string) {
    const room = this.getRoomBySocket(socketId);
    if (!room) return;
    this.socketToRoom.delete(socketId);
    room.handleDisconnect(socketId);
  }

  registerSocketEvents(socket: Socket) {
    socket.on(CLIENT_EVENTS.ROOM_CREATE, ({ playerName, avatarDataUrl }) => {
      // Prevent double-joining
      if (this.socketToRoom.has(socket.id)) {
        socket.emit(SERVER_EVENTS.ROOM_ERROR, { message: 'You are already in a room.' });
        return;
      }
      this.createRoom(socket, playerName ?? 'Player', avatarDataUrl ?? null);
    });

    socket.on(CLIENT_EVENTS.ROOM_JOIN, ({ code, playerName, avatarDataUrl }) => {
      if (this.socketToRoom.has(socket.id)) {
        socket.emit(SERVER_EVENTS.ROOM_ERROR, { message: 'You are already in a room.' });
        return;
      }
      this.joinRoom(socket, code ?? '', playerName ?? 'Player', avatarDataUrl ?? null);
    });

    socket.on(CLIENT_EVENTS.LOBBY_READY, () => {
      const room = this.getRoomBySocket(socket.id);
      room?.setReady(socket.id);
    });

    socket.on(CLIENT_EVENTS.INPUT_UPDATE, ({ direction, seq }) => {
      const room = this.getRoomBySocket(socket.id);
      room?.handleInput(socket.id, direction, seq);
    });

    socket.on(CLIENT_EVENTS.MATCH_REMATCH, () => {
      const room = this.getRoomBySocket(socket.id);
      room?.handleRematch(socket.id);
    });

    socket.on(CLIENT_EVENTS.MATCH_EXIT, () => {
      const room = this.getRoomBySocket(socket.id);
      if (room) {
        this.socketToRoom.delete(socket.id);
        room.handleExit(socket.id);
      }
    });

    socket.on(CLIENT_EVENTS.MATCH_REJOIN, ({ code }) => {
      const upperCode = (code ?? '').toUpperCase().trim();
      const room = this.rooms.get(upperCode);
      if (room) {
        this.socketToRoom.set(socket.id, upperCode);
        room.handleRejoin(socket);
      }
    });

    socket.on(CLIENT_EVENTS.PING, ({ clientTime }) => {
      socket.emit(SERVER_EVENTS.PONG, { serverTime: Date.now(), clientTime });
    });
  }
}
