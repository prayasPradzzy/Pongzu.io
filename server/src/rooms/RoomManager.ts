import type { Server, Socket } from 'socket.io';
import { Room } from './Room.js';
import { generateRoomCode } from '../protocol/roomCode.js';
import { SERVER_EVENTS, CLIENT_EVENTS } from '../protocol/events.js';
import {
  asRecord,
  sanitizeAvatar,
  sanitizeDirection,
  sanitizeName,
  sanitizeRoomCode,
  sanitizeSeq,
  sanitizeTargetX,
  sanitizeToken,
} from '../protocol/validation.js';

const MAX_ROOMS = 500;

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  /** Map from socketId → room code for fast lookup on disconnect */
  private readonly socketToRoom = new Map<string, string>();
  private readonly io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  createRoom(socket: Socket, playerName: string, avatarDataUrl: string | null): void {
    if (this.rooms.size >= MAX_ROOMS) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, { message: 'The server is full right now. Try again in a minute.' });
      return;
    }

    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }

    const room = new Room(code, this.io, (c) => this.destroyRoom(c));
    room.addHost(socket, playerName, avatarDataUrl);
    this.rooms.set(code, room);
    this.socketToRoom.set(socket.id, code);

    console.log(`[Room ${code}] Created (${socket.id})`);

    socket.emit(SERVER_EVENTS.ROOM_CREATED, {
      code,
      role: 'host',
      reconnectToken: room.host!.reconnectToken,
    });
  }

  joinRoom(socket: Socket, code: string | null, playerName: string, avatarDataUrl: string | null): void {
    const room = code ? this.rooms.get(code) : undefined;

    if (!code || !room) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, { message: 'Room not found. Check the code and try again.' });
      return;
    }

    if (!room.isJoinable()) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, { message: 'That room is already full.' });
      return;
    }

    room.addGuest(socket, playerName, avatarDataUrl);
    this.socketToRoom.set(socket.id, code);

    console.log(`[Room ${code}] Guest joined (${socket.id})`);

    socket.emit(SERVER_EVENTS.ROOM_JOINED, {
      code,
      role: 'guest',
      opponentName: room.host?.playerName ?? 'Host',
      opponentAvatarUrl: room.host?.avatarDataUrl ?? null,
      reconnectToken: room.guest!.reconnectToken,
    });

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

  /** Used by the invite-link check: does this room exist, and can someone still join it? */
  getRoomStatus(code: string | null): { exists: boolean; joinable: boolean } {
    const room = code ? this.rooms.get(code) : undefined;
    return { exists: !!room, joinable: !!room && room.isJoinable() };
  }

  private getRoomByToken(token: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.getPlayerByToken(token)) return room;
    }
    return null;
  }

  destroyRoom(code: string) {
    if (!this.rooms.delete(code)) return;

    for (const [socketId, mappedCode] of this.socketToRoom.entries()) {
      if (mappedCode === code) {
        this.socketToRoom.delete(socketId);
      }
    }

    console.log(`[Room ${code}] Destroyed`);
  }

  handleDisconnect(socketId: string) {
    const room = this.getRoomBySocket(socketId);
    this.socketToRoom.delete(socketId);
    room?.handleDisconnect(socketId);
  }

  registerSocketEvents(socket: Socket) {
    // A throwing handler must never take the whole server (and every other
    // room) down with it, so every listener goes through this wrapper.
    const on = (event: string, handler: (payload: Record<string, unknown>) => void) => {
      socket.on(event, (payload: unknown) => {
        try {
          handler(asRecord(payload));
        } catch (error) {
          console.error(`[Socket ${socket.id}] Error handling "${event}":`, error);
        }
      });
    };

    on(CLIENT_EVENTS.ROOM_CREATE, (payload) => {
      if (this.socketToRoom.has(socket.id)) {
        socket.emit(SERVER_EVENTS.ROOM_ERROR, { message: 'You are already in a room.' });
        return;
      }
      this.createRoom(socket, sanitizeName(payload.playerName), sanitizeAvatar(payload.avatarDataUrl));
    });

    on(CLIENT_EVENTS.ROOM_JOIN, (payload) => {
      if (this.socketToRoom.has(socket.id)) {
        socket.emit(SERVER_EVENTS.ROOM_ERROR, { message: 'You are already in a room.' });
        return;
      }
      this.joinRoom(
        socket,
        sanitizeRoomCode(payload.code),
        sanitizeName(payload.playerName),
        sanitizeAvatar(payload.avatarDataUrl),
      );
    });

    on(CLIENT_EVENTS.LOBBY_READY, () => {
      this.getRoomBySocket(socket.id)?.setReady(socket.id);
    });

    on(CLIENT_EVENTS.INPUT_UPDATE, (payload) => {
      const direction = sanitizeDirection(payload.direction);
      if (direction === null) return;
      this.getRoomBySocket(socket.id)?.handleInput(
        socket.id,
        direction,
        sanitizeTargetX(payload.targetX),
        sanitizeSeq(payload.seq),
      );
    });

    on(CLIENT_EVENTS.MATCH_REMATCH, () => {
      this.getRoomBySocket(socket.id)?.handleRematch(socket.id);
    });

    on(CLIENT_EVENTS.MATCH_EXIT, () => {
      const room = this.getRoomBySocket(socket.id);
      if (!room) return;
      room.handleExit(socket.id);
      this.socketToRoom.delete(socket.id);
    });

    on(CLIENT_EVENTS.MATCH_REJOIN, (payload) => {
      const token = sanitizeToken(payload.token);
      const room = token ? this.getRoomByToken(token) : null;
      const result = room && token ? room.handleRejoin(socket, token) : { ok: false as const };

      if (!room || !result.ok) {
        socket.emit(SERVER_EVENTS.ROOM_CLOSED, { reason: 'That match is no longer available.' });
        return;
      }

      this.socketToRoom.set(socket.id, room.code);
      if (result.replacedSocketId) {
        // Unmap first so the stale socket's disconnect doesn't pause the match.
        this.socketToRoom.delete(result.replacedSocketId);
        this.io.sockets.sockets.get(result.replacedSocketId)?.disconnect(true);
      }
    });

    on(CLIENT_EVENTS.PING, (payload) => {
      socket.emit(SERVER_EVENTS.PONG, { serverTime: Date.now(), clientTime: sanitizeSeq(payload.clientTime) });
    });
  }
}
