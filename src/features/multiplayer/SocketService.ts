import { io, type Socket } from 'socket.io-client';
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type RoomCreatePayload,
  type RoomJoinPayload,
  type InputUpdatePayload,
  type MatchRejoinPayload,
  type PingPayload,
  type RoomCreatedPayload,
  type RoomJoinedPayload,
  type RoomOpponentJoinedPayload,
  type RoomErrorPayload,
  type MatchStartPayload,
  type StateSnapshot,
  type GameScorePayload,
  type GameRoundStartPayload,
  type GameRoundEndPayload,
  type GameCountdownPayload,
  type MatchOverPayload,
  type MatchRematchVotePayload,
  type MatchRematchStartPayload,
  type PlayerDisconnectedPayload,
  type MatchStateChangePayload,
  type PongPayload,
} from '../../../server/src/protocol/events';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export class SocketService {
  private socket: Socket | null = null;
  private _status: ConnectionStatus = 'idle';
  private statusListeners: Array<(s: ConnectionStatus) => void> = [];
  /** Estimated offset between client clock and server clock (ms) */
  serverTimeOffset = 0;
  
  private reconnectToken: string | null = null;

  get status(): ConnectionStatus {
    return this._status;
  }

  connect(serverUrl: string = 'http://localhost:3001') {
    if (this.socket?.connected) return;

    this._setStatus('connecting');

    this.socket = io(serverUrl, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this._setStatus('connected');
      this.syncClock();
      
      // Auto-rejoin if we have a token
      if (this.reconnectToken) {
        this.sendRejoin({ token: this.reconnectToken });
      }
    });

    this.socket.on('disconnect', () => {
      this._setStatus('idle');
    });

    this.socket.on('connect_error', () => {
      this._setStatus('error');
    });

    this.socket.on(SERVER_EVENTS.PONG, (payload: PongPayload) => {
      const t3 = Date.now();
      this.serverTimeOffset = (payload.clientTime + t3) / 2 - payload.serverTime;
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.reconnectToken = null;
    this._setStatus('idle');
  }

  // ─── Emit helpers ─────────────────────────────────────────────────────────

  createRoom(payload: RoomCreatePayload) {
    this.socket?.emit(CLIENT_EVENTS.ROOM_CREATE, payload);
  }

  joinRoom(payload: RoomJoinPayload) {
    this.socket?.emit(CLIENT_EVENTS.ROOM_JOIN, payload);
  }

  sendReady() {
    this.socket?.emit(CLIENT_EVENTS.LOBBY_READY);
  }

  sendInput(payload: InputUpdatePayload) {
    this.socket?.emit(CLIENT_EVENTS.INPUT_UPDATE, payload);
  }

  sendRematch() {
    this.socket?.emit(CLIENT_EVENTS.MATCH_REMATCH);
  }

  sendExit() {
    this.socket?.emit(CLIENT_EVENTS.MATCH_EXIT);
  }

  sendRejoin(payload: MatchRejoinPayload) {
    this.socket?.emit(CLIENT_EVENTS.MATCH_REJOIN, payload);
  }

  // ─── Listener helpers ─────────────────────────────────────────────────────

  onRoomCreated(cb: (p: RoomCreatedPayload) => void) { 
    this.socket?.on(SERVER_EVENTS.ROOM_CREATED, (p: RoomCreatedPayload) => {
      this.reconnectToken = p.reconnectToken;
      cb(p);
    }); 
  }
  onRoomJoined(cb: (p: RoomJoinedPayload) => void) { 
    this.socket?.on(SERVER_EVENTS.ROOM_JOINED, (p: RoomJoinedPayload) => {
      this.reconnectToken = p.reconnectToken;
      cb(p);
    }); 
  }
  onRoomOpponentJoined(cb: (p: RoomOpponentJoinedPayload) => void) { this.socket?.on(SERVER_EVENTS.ROOM_OPPONENT_JOINED, cb); }
  onRoomError(cb: (p: RoomErrorPayload) => void) { this.socket?.on(SERVER_EVENTS.ROOM_ERROR, cb); }
  onLobbyOpponentReady(cb: () => void) { this.socket?.on(SERVER_EVENTS.LOBBY_OPPONENT_READY, cb); }
  onMatchStart(cb: (p: MatchStartPayload) => void) { this.socket?.on(SERVER_EVENTS.MATCH_START, cb); }
  onGameStateSnapshot(cb: (p: StateSnapshot) => void) { this.socket?.on(SERVER_EVENTS.GAME_STATE_SNAPSHOT, cb); }
  onGameScore(cb: (p: GameScorePayload) => void) { this.socket?.on(SERVER_EVENTS.GAME_SCORE, cb); }
  onGameRoundStart(cb: (p: GameRoundStartPayload) => void) { this.socket?.on(SERVER_EVENTS.GAME_ROUND_START, cb); }
  onGameRoundEnd(cb: (p: GameRoundEndPayload) => void) { this.socket?.on(SERVER_EVENTS.GAME_ROUND_END, cb); }
  onGameCountdown(cb: (p: GameCountdownPayload) => void) { this.socket?.on(SERVER_EVENTS.GAME_COUNTDOWN, cb); }
  onMatchOver(cb: (p: MatchOverPayload) => void) { this.socket?.on(SERVER_EVENTS.MATCH_OVER, cb); }
  onMatchRematchVote(cb: (p: MatchRematchVotePayload) => void) { this.socket?.on(SERVER_EVENTS.MATCH_REMATCH_VOTE, cb); }
  onMatchRematchStart(cb: (p: MatchRematchStartPayload) => void) { this.socket?.on(SERVER_EVENTS.MATCH_REMATCH_START, cb); }
  onPlayerDisconnected(cb: (p: PlayerDisconnectedPayload) => void) { this.socket?.on(SERVER_EVENTS.PLAYER_DISCONNECTED, cb); }
  onPlayerReconnected(cb: () => void) { this.socket?.on(SERVER_EVENTS.PLAYER_RECONNECTED, cb); }
  onMatchStateChange(cb: (p: MatchStateChangePayload) => void) { this.socket?.on(SERVER_EVENTS.MATCH_STATE_CHANGE, cb); }
  onRoomClosed(cb: (p: { reason?: string }) => void) { this.socket?.on(SERVER_EVENTS.ROOM_CLOSED, cb); }

  offAll() {
    if (!this.socket) return;
    Object.values(SERVER_EVENTS).forEach((ev) => this.socket!.off(ev));
  }

  onStatusChange(cb: (s: ConnectionStatus) => void) {
    this.statusListeners.push(cb);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== cb);
    };
  }

  private _setStatus(s: ConnectionStatus) {
    this._status = s;
    this.statusListeners.forEach((l) => l(s));
  }

  private syncClock() {
    const pingPayload: PingPayload = { clientTime: Date.now() };
    this.socket?.emit(CLIENT_EVENTS.PING, pingPayload);
  }
}

// Singleton export — both React components and Phaser scenes import this
export const socketService = new SocketService();
