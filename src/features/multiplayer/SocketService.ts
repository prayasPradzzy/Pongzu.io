import { io, type Socket } from 'socket.io-client';
import { SERVER_URL } from '../../config/env';
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type RoomCreatePayload,
  type RoomJoinPayload,
  type InputUpdatePayload,
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
  type MatchRejoinedPayload,
  type PlayerDisconnectedPayload,
  type MatchStateChangePayload,
  type RoomClosedPayload,
  type PongPayload,
} from '../../protocol/events';

/**
 * idle         – not connected and not trying
 * connecting   – first connection in progress (may take a while if the server is waking up)
 * connected    – live
 * reconnecting – was connected, lost it, retrying
 * failed       – gave up
 */
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

type Unsubscribe = () => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (payload: any) => void;

const PING_INTERVAL_MS = 2000;

export class SocketService {
  private socket: Socket | null = null;
  private _status: ConnectionStatus = 'idle';
  private statusListeners: Array<(s: ConnectionStatus) => void> = [];
  private subscriptions: Array<{ event: string; listener: Listener }> = [];
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private hasConnectedOnce = false;
  private reconnectToken: string | null = null;

  /** Smoothed round-trip time in ms. */
  ping = 0;

  get status(): ConnectionStatus {
    return this._status;
  }

  connect() {
    if (this.socket) {
      if (!this.socket.connected) this.socket.connect();
      return;
    }

    this.hasConnectedOnce = false;
    this.setStatus('connecting');

    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      // Generous enough to ride out a free-tier server cold start (~30–60s).
      reconnectionAttempts: 15,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
      timeout: 20000,
    });
    this.socket = socket;

    socket.on('connect', () => {
      this.hasConnectedOnce = true;
      this.setStatus('connected');
      this.startPingLoop();

      // Mid-room reconnect: reclaim our seat.
      if (this.reconnectToken) {
        socket.emit(CLIENT_EVENTS.MATCH_REJOIN, { token: this.reconnectToken });
      }
    });

    socket.on('disconnect', (reason) => {
      this.stopPingLoop();
      if (reason === 'io client disconnect') return; // we asked for it
      this.setStatus('reconnecting');
      // The server kicking us doesn't trigger auto-reconnect; do it ourselves.
      if (reason === 'io server disconnect') socket.connect();
    });

    socket.on('connect_error', () => {
      this.setStatus(this.hasConnectedOnce ? 'reconnecting' : 'connecting');
    });

    socket.io.on('reconnect_failed', () => {
      this.setStatus('failed');
    });

    socket.on(SERVER_EVENTS.PONG, (payload: PongPayload) => {
      const rtt = Date.now() - payload.clientTime;
      if (rtt < 0 || rtt > 10_000) return;
      this.ping = this.ping === 0 ? rtt : this.ping * 0.7 + rtt * 0.3;
    });

    const rememberToken = (payload: { reconnectToken: string }) => {
      this.reconnectToken = payload.reconnectToken;
    };
    socket.on(SERVER_EVENTS.ROOM_CREATED, rememberToken);
    socket.on(SERVER_EVENTS.ROOM_JOINED, rememberToken);
    socket.on(SERVER_EVENTS.ROOM_CLOSED, () => {
      this.reconnectToken = null;
    });
  }

  /** Leave for good: drops the room seat and every listener. */
  disconnect() {
    this.stopPingLoop();
    this.subscriptions = [];
    this.reconnectToken = null;
    this.ping = 0;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.io.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.setStatus('idle');
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
    // Inputs are only meaningful right now — never queue them while offline.
    if (this.socket?.connected) this.socket.emit(CLIENT_EVENTS.INPUT_UPDATE, payload);
  }

  sendRematch() {
    this.socket?.emit(CLIENT_EVENTS.MATCH_REMATCH);
  }

  sendExit() {
    if (this.socket?.connected) this.socket.emit(CLIENT_EVENTS.MATCH_EXIT);
  }

  // ─── Listener helpers (each returns an unsubscribe function) ──────────────

  onRoomCreated(cb: (p: RoomCreatedPayload) => void) { return this.subscribe(SERVER_EVENTS.ROOM_CREATED, cb); }
  onRoomJoined(cb: (p: RoomJoinedPayload) => void) { return this.subscribe(SERVER_EVENTS.ROOM_JOINED, cb); }
  onRoomOpponentJoined(cb: (p: RoomOpponentJoinedPayload) => void) { return this.subscribe(SERVER_EVENTS.ROOM_OPPONENT_JOINED, cb); }
  onRoomOpponentLeft(cb: () => void) { return this.subscribe(SERVER_EVENTS.ROOM_OPPONENT_LEFT, cb); }
  onRoomError(cb: (p: RoomErrorPayload) => void) { return this.subscribe(SERVER_EVENTS.ROOM_ERROR, cb); }
  onRoomClosed(cb: (p: RoomClosedPayload) => void) { return this.subscribe(SERVER_EVENTS.ROOM_CLOSED, cb); }
  onLobbyOpponentReady(cb: () => void) { return this.subscribe(SERVER_EVENTS.LOBBY_OPPONENT_READY, cb); }
  onMatchStart(cb: (p: MatchStartPayload) => void) { return this.subscribe(SERVER_EVENTS.MATCH_START, cb); }
  onGameStateSnapshot(cb: (p: StateSnapshot) => void) { return this.subscribe(SERVER_EVENTS.GAME_STATE_SNAPSHOT, cb); }
  onGameScore(cb: (p: GameScorePayload) => void) { return this.subscribe(SERVER_EVENTS.GAME_SCORE, cb); }
  onGameRoundStart(cb: (p: GameRoundStartPayload) => void) { return this.subscribe(SERVER_EVENTS.GAME_ROUND_START, cb); }
  onGameRoundEnd(cb: (p: GameRoundEndPayload) => void) { return this.subscribe(SERVER_EVENTS.GAME_ROUND_END, cb); }
  onGameCountdown(cb: (p: GameCountdownPayload) => void) { return this.subscribe(SERVER_EVENTS.GAME_COUNTDOWN, cb); }
  onMatchOver(cb: (p: MatchOverPayload) => void) { return this.subscribe(SERVER_EVENTS.MATCH_OVER, cb); }
  onMatchRematchVote(cb: (p: MatchRematchVotePayload) => void) { return this.subscribe(SERVER_EVENTS.MATCH_REMATCH_VOTE, cb); }
  onMatchRematchStart(cb: (p: MatchRematchStartPayload) => void) { return this.subscribe(SERVER_EVENTS.MATCH_REMATCH_START, cb); }
  onMatchRejoined(cb: (p: MatchRejoinedPayload) => void) { return this.subscribe(SERVER_EVENTS.MATCH_REJOINED, cb); }
  onPlayerDisconnected(cb: (p: PlayerDisconnectedPayload) => void) { return this.subscribe(SERVER_EVENTS.PLAYER_DISCONNECTED, cb); }
  onPlayerReconnected(cb: () => void) { return this.subscribe(SERVER_EVENTS.PLAYER_RECONNECTED, cb); }
  onMatchStateChange(cb: (p: MatchStateChangePayload) => void) { return this.subscribe(SERVER_EVENTS.MATCH_STATE_CHANGE, cb); }

  onStatusChange(cb: (s: ConnectionStatus) => void): Unsubscribe {
    this.statusListeners.push(cb);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== cb);
    };
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private subscribe(event: string, listener: Listener): Unsubscribe {
    const socket = this.socket;
    if (!socket) return () => {};
    const entry = { event, listener };
    this.subscriptions.push(entry);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
      this.subscriptions = this.subscriptions.filter((s) => s !== entry);
    };
  }

  private setStatus(status: ConnectionStatus) {
    if (this._status === status) return;
    this._status = status;
    this.statusListeners.forEach((l) => l(status));
  }

  private startPingLoop() {
    this.stopPingLoop();
    const send = () => this.socket?.emit(CLIENT_EVENTS.PING, { clientTime: Date.now() });
    send();
    this.pingTimer = setInterval(send, PING_INTERVAL_MS);
  }

  private stopPingLoop() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

/** Fire-and-forget request that wakes a sleeping free-tier server before the player needs it. */
export function warmUpServer() {
  fetch(`${SERVER_URL}/healthz`, { mode: 'no-cors' }).catch(() => {});
}

// Singleton export — both React components and Phaser scenes import this
export const socketService = new SocketService();
