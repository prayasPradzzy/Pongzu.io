import type { Server, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import {
  SERVER_EVENTS,
  type Role,
  type MatchState,
  type ServeDirection,
  type StateSnapshot,
  type PaddleSide,
} from '../protocol/events.js';
import { ServerBallSimulator, SERVER_PONG_CONFIG, round1 } from '../game/ServerBallSimulator.js';
import { ServerScoreManager } from '../game/ServerScoreManager.js';

// Fixed arena dimensions — matches the client's Phaser game size
const ARENA_WIDTH = 800;
const ARENA_HEIGHT = 600;
const TICK_RATE_HZ = 60;
const TICK_MS = 1000 / TICK_RATE_HZ;
// Physics advances in small fixed slices so a late timer can never make the
// ball skip through a paddle.
const SUBSTEP_MS = 4;
const MAX_TICK_DELTA_MS = 100;

const REMATCH_TIMEOUT_MS = 60_000;
export const RECONNECT_GRACE_MS = 20_000;

export type PlayerSlot = {
  socketId: string;
  role: Role;
  connected: boolean;
  paddleX: number;
  inputDirection: -1 | 0 | 1;
  /** Touch target; overrides inputDirection while set. */
  targetX: number | null;
  /** Direction the paddle actually moved last step — used for spin. */
  moveDirection: number;
  lastInputSeq: number;
  playerName: string;
  avatarDataUrl: string | null;
  ready: boolean;
  rematchVote: boolean;
  reconnectToken: string;
};

export type RoomState =
  | 'waiting'       // only host in room
  | 'ready_check'   // both players present, waiting for both to click Ready
  | 'countdown'     // counting down before round start
  | 'active'        // ball in play
  | 'round_paused'  // point scored, brief pause
  | 'match_over'    // match finished
  | 'disconnected'; // a player dropped mid-match, grace window open

const MATCH_STATE: Record<RoomState, MatchState> = {
  waiting: 'lobby',
  ready_check: 'ready',
  countdown: 'countdown',
  active: 'playing',
  round_paused: 'point_scored',
  match_over: 'match_over',
  disconnected: 'point_scored', // frozen; client shows its own overlay
};

export type RejoinResult = { ok: false } | { ok: true; replacedSocketId: string | null };

export class Room {
  readonly code: string;
  host: PlayerSlot | null = null;
  guest: PlayerSlot | null = null;
  state: RoomState = 'waiting';

  private ball: ServerBallSimulator;
  private scoreManager: ServerScoreManager;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private rematchTimer: ReturnType<typeof setTimeout> | null = null;
  private tickSeq = 0;
  private lastTickTime = 0;
  private nextServe: ServeDirection = 'down';
  private destroyed = false;
  private readonly io: Server;
  private onDestroy: (code: string) => void;

  constructor(code: string, io: Server, onDestroy: (code: string) => void) {
    this.code = code;
    this.io = io;
    this.onDestroy = onDestroy;
    this.ball = new ServerBallSimulator(ARENA_WIDTH, ARENA_HEIGHT);
    this.scoreManager = new ServerScoreManager();
  }

  // ─── Player management ───────────────────────────────────────────────────

  addHost(socket: Socket, playerName: string, avatarDataUrl: string | null) {
    this.host = this.createSlot(socket, 'host', playerName, avatarDataUrl);
    socket.join(this.code);
  }

  addGuest(socket: Socket, playerName: string, avatarDataUrl: string | null) {
    this.guest = this.createSlot(socket, 'guest', playerName, avatarDataUrl);
    socket.join(this.code);
    this.state = 'ready_check';
  }

  isJoinable(): boolean {
    return this.state === 'waiting' && this.host !== null && this.guest === null;
  }

  setReady(socketId: string) {
    const player = this.getPlayerBySocket(socketId);
    if (!player || this.state !== 'ready_check') return;
    player.ready = true;

    const opponent = this.getOpponent(player);
    if (opponent) {
      this.io.to(opponent.socketId).emit(SERVER_EVENTS.LOBBY_OPPONENT_READY);
    }

    if (this.host?.ready && this.guest?.ready) {
      this.startMatch();
    }
  }

  handleInput(socketId: string, direction: -1 | 0 | 1, targetX: number | null, seq: number) {
    // Paddles stay movable between points so players can set up for the serve.
    if (!this.isSimulating()) return;
    const player = this.getPlayerBySocket(socketId);
    if (!player) return;
    player.inputDirection = direction;
    player.targetX = targetX;
    player.lastInputSeq = seq;
  }

  /** The socket dropped without saying goodbye (network loss, closed tab). */
  handleDisconnect(socketId: string) {
    const player = this.getPlayerBySocket(socketId);
    if (!player) return;
    const opponent = this.getOpponent(player);

    if (this.state === 'waiting' || this.state === 'ready_check') {
      this.removeFromLobby(player);
      return;
    }

    if (this.state === 'match_over') {
      this.closeRoom(opponent, 'Your opponent left.');
      return;
    }

    if (this.state === 'disconnected') {
      // The other player is already gone too — nobody left to wait for.
      this.destroy();
      return;
    }

    // Mid-match: freeze everything and give the player a chance to come back.
    this.stopTick();
    this.clearPendingTimers();
    this.resetInputDirections();
    this.state = 'disconnected';
    player.connected = false;

    if (opponent) {
      this.io.to(opponent.socketId).emit(SERVER_EVENTS.PLAYER_DISCONNECTED, {
        role: player.role,
        reason: 'connection lost',
        graceMs: RECONNECT_GRACE_MS,
      });
    }

    this.disconnectTimer = setTimeout(() => {
      this.disconnectTimer = null;
      this.forfeit(player);
    }, RECONNECT_GRACE_MS);
  }

  /** A client presents its reconnect token on a fresh socket. */
  handleRejoin(socket: Socket, token: string): RejoinResult {
    const player = this.getPlayerByToken(token);
    if (!player || this.destroyed) return { ok: false };
    if (player.socketId === socket.id) return { ok: true, replacedSocketId: null };

    const previousSocketId = player.socketId;
    const wasConnected = player.connected;
    player.socketId = socket.id;
    player.connected = true;
    player.inputDirection = 0;
    player.targetX = null;
    socket.join(this.code);

    socket.emit(SERVER_EVENTS.MATCH_REJOINED, {
      topScore: this.scoreManager.getTopScore(),
      bottomScore: this.scoreManager.getBottomScore(),
    });

    if (!wasConnected && this.state === 'disconnected') {
      if (this.disconnectTimer) {
        clearTimeout(this.disconnectTimer);
        this.disconnectTimer = null;
      }
      const opponent = this.getOpponent(player);
      if (opponent) {
        this.io.to(opponent.socketId).emit(SERVER_EVENTS.PLAYER_RECONNECTED);
      }
      // Replay the interrupted rally from a fresh serve.
      this.ball.reset();
      this.startTick();
      this.runCountdownThenServe(this.nextServe);
      return { ok: true, replacedSocketId: null };
    }

    // The client reconnected before the server noticed the old socket die:
    // just swap sockets and carry on.
    return { ok: true, replacedSocketId: previousSocketId };
  }

  handleRematch(socketId: string) {
    const player = this.getPlayerBySocket(socketId);
    if (!player || this.state !== 'match_over' || player.rematchVote) return;
    player.rematchVote = true;

    const opponent = this.getOpponent(player);
    if (opponent) {
      this.io.to(opponent.socketId).emit(SERVER_EVENTS.MATCH_REMATCH_VOTE, { from: player.role });
    }

    if (this.host?.rematchVote && this.guest?.rematchVote) {
      if (this.rematchTimer) {
        clearTimeout(this.rematchTimer);
        this.rematchTimer = null;
      }
      this.scoreManager.reset();
      this.host.rematchVote = false;
      this.guest.rematchVote = false;
      this.centerPaddles();
      this.ball.reset();
      const serveDir: ServeDirection = Math.random() < 0.5 ? 'down' : 'up';
      this.io.to(this.code).emit(SERVER_EVENTS.MATCH_REMATCH_START, { serveDirection: serveDir });
      this.startTick();
      this.runCountdownThenServe(serveDir);
    }
  }

  /** The player deliberately left (Leave Room / Return to Menu). */
  handleExit(socketId: string) {
    const player = this.getPlayerBySocket(socketId);
    if (!player) return;
    const opponent = this.getOpponent(player);

    if (this.state === 'waiting' || this.state === 'ready_check') {
      this.removeFromLobby(player);
      return;
    }

    if (this.state === 'match_over') {
      this.closeRoom(opponent, 'Your opponent left.');
      return;
    }

    this.forfeit(player);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.state = 'match_over'; // prevent timer callbacks
    this.stopTick();
    this.clearPendingTimers();
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    if (this.rematchTimer) clearTimeout(this.rematchTimer);
    this.disconnectTimer = null;
    this.rematchTimer = null;
    // Detach sockets so a future room that reuses this code can't reach them.
    this.io.in(this.code).socketsLeave(this.code);
    this.onDestroy(this.code);
  }

  getPlayerByToken(token: string): PlayerSlot | null {
    if (this.host?.reconnectToken === token) return this.host;
    if (this.guest?.reconnectToken === token) return this.guest;
    return null;
  }

  // ─── Leaving ──────────────────────────────────────────────────────────────

  private removeFromLobby(player: PlayerSlot) {
    if (player.role === 'host') {
      this.closeRoom(this.guest, 'The host left the room.');
      return;
    }

    // Guest left: the room goes back to waiting so the host can re-share the code.
    this.io.in(player.socketId).socketsLeave(this.code);
    this.guest = null;
    this.state = 'waiting';
    if (this.host) {
      this.host.ready = false;
      this.io.to(this.host.socketId).emit(SERVER_EVENTS.ROOM_OPPONENT_LEFT);
    }
  }

  /** Ends a running match in favour of whoever is still here. */
  private forfeit(leaver: PlayerSlot) {
    const opponent = this.getOpponent(leaver);
    if (opponent && opponent.connected) {
      this.io.to(opponent.socketId).emit(SERVER_EVENTS.MATCH_OVER, {
        winner: opponent.role,
        reason: 'opponent_disconnected',
        stats: this.scoreManager.getStats(),
      });
    }
    this.destroy();
  }

  private closeRoom(remaining: PlayerSlot | null, reason: string) {
    if (remaining && remaining.connected) {
      this.io.to(remaining.socketId).emit(SERVER_EVENTS.ROOM_CLOSED, { reason });
    }
    this.destroy();
  }

  // ─── Match flow ───────────────────────────────────────────────────────────

  private startMatch() {
    this.scoreManager.reset();
    this.ball.reset();
    this.centerPaddles();

    const serveDir: ServeDirection = Math.random() < 0.5 ? 'down' : 'up';

    this.io.to(this.code).emit(SERVER_EVENTS.MATCH_START, {
      serveDirection: serveDir,
      hostIsTop: true, // host always owns the top paddle in server space
    });

    this.startTick();
    this.runCountdownThenServe(serveDir);
  }

  private runCountdownThenServe(serveDir: ServeDirection) {
    this.nextServe = serveDir;
    this.setState('countdown');
    const ticks = ['3', '2', '1', 'GO'];
    let idx = 0;

    const tick = () => {
      if (this.state !== 'countdown') return;
      if (idx < ticks.length) {
        this.io.to(this.code).emit(SERVER_EVENTS.GAME_COUNTDOWN, { value: ticks[idx] });
        idx++;
        this.later(tick, SERVER_PONG_CONFIG.countdownMs);
      } else {
        this.startRound(serveDir);
      }
    };
    tick();
  }

  private startRound(serveDir: ServeDirection) {
    this.ball.reset();
    this.ball.setSpeed(this.scoreManager.getCurrentBallSpeed());
    this.ball.serve(serveDir);

    this.io.to(this.code).emit(SERVER_EVENTS.GAME_ROUND_START, {
      serveDirection: serveDir,
      ballSpeed: this.ball.speed,
      countdown: false,
    });

    this.setState('active');
  }

  // ─── Tick loop ────────────────────────────────────────────────────────────

  private isSimulating(): boolean {
    return this.state === 'countdown' || this.state === 'active' || this.state === 'round_paused';
  }

  private startTick() {
    if (this.tickInterval) return;
    this.lastTickTime = Date.now();
    this.tickInterval = setInterval(() => this.tick(), TICK_MS);
  }

  private stopTick() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private tick() {
    if (!this.isSimulating()) return;

    const now = Date.now();
    let remaining = Math.min(now - this.lastTickTime, MAX_TICK_DELTA_MS);
    this.lastTickTime = now;

    while (remaining > 0 && this.isSimulating()) {
      const step = Math.min(remaining, SUBSTEP_MS);
      this.simulate(step);
      remaining -= step;
    }

    if (this.isSimulating()) {
      this.broadcastSnapshot(now);
    }
  }

  private simulate(stepMs: number) {
    this.movePaddle(this.host, stepMs);
    this.movePaddle(this.guest, stepMs);

    if (this.state !== 'active') return;

    this.ball.step(stepMs);
    this.checkPaddleCollisions();

    const scoringSide = this.ball.checkOutOfBounds();
    if (scoringSide) {
      this.handlePoint(scoringSide);
    }
  }

  private movePaddle(player: PlayerSlot | null, stepMs: number) {
    if (!player) return;
    const halfWidth = SERVER_PONG_CONFIG.paddle.width / 2;
    const leftLimit = SERVER_PONG_CONFIG.arenaPadding + halfWidth;
    const rightLimit = ARENA_WIDTH - SERVER_PONG_CONFIG.arenaPadding - halfWidth;
    const maxStep = SERVER_PONG_CONFIG.paddle.speed * (stepMs / 1000);

    // Mirror of advancePaddle() in the client's PongSimulation.
    const wanted =
      player.targetX !== null
        ? Math.max(-maxStep, Math.min(maxStep, player.targetX - player.paddleX))
        : player.inputDirection * maxStep;
    const next = Math.max(leftLimit, Math.min(rightLimit, player.paddleX + wanted));
    const moved = next - player.paddleX;
    player.moveDirection = Math.abs(moved) > 0.01 ? Math.sign(moved) : 0;
    player.paddleX = next;
  }

  private broadcastSnapshot(now: number) {
    this.tickSeq++;
    const snapshot: StateSnapshot = {
      seq: this.tickSeq,
      timestamp: now,
      state: MATCH_STATE[this.state],
      ball: this.ball.getState(),
      hostPaddleX: round1(this.host?.paddleX ?? ARENA_WIDTH / 2),
      guestPaddleX: round1(this.guest?.paddleX ?? ARENA_WIDTH / 2),
      topScore: this.scoreManager.getTopScore(),
      bottomScore: this.scoreManager.getBottomScore(),
    };
    this.io.to(this.code).emit(SERVER_EVENTS.GAME_STATE_SNAPSHOT, snapshot);
  }

  private checkPaddleCollisions() {
    const radius = SERVER_PONG_CONFIG.ball.radius;
    const topPaddleY = SERVER_PONG_CONFIG.paddle.topOffset;
    const bottomPaddleY = ARENA_HEIGHT - SERVER_PONG_CONFIG.paddle.bottomOffset;
    const halfHeight = SERVER_PONG_CONFIG.paddle.height / 2;
    const reach = SERVER_PONG_CONFIG.paddle.width / 2 + radius;

    // Top paddle (host): ball travelling up, leading edge inside the paddle slab
    if (
      this.host &&
      this.ball.vy < 0 &&
      this.ball.y - radius <= topPaddleY + halfHeight &&
      this.ball.y >= topPaddleY - halfHeight &&
      Math.abs(this.ball.x - this.host.paddleX) <= reach
    ) {
      this.ball.y = topPaddleY + halfHeight + radius;
      this.bounce(this.host, 'top');
    }

    // Bottom paddle (guest)
    if (
      this.guest &&
      this.ball.vy > 0 &&
      this.ball.y + radius >= bottomPaddleY - halfHeight &&
      this.ball.y <= bottomPaddleY + halfHeight &&
      Math.abs(this.ball.x - this.guest.paddleX) <= reach
    ) {
      this.ball.y = bottomPaddleY - halfHeight - radius;
      this.bounce(this.guest, 'bottom');
    }
  }

  private bounce(player: PlayerSlot, side: PaddleSide) {
    this.ball.setSpeed(this.scoreManager.registerPaddleHit());
    this.ball.bounceFromPaddle(player.paddleX, SERVER_PONG_CONFIG.paddle.width, side, player.moveDirection);
  }

  private handlePoint(scoringSide: PaddleSide) {
    this.ball.reset();
    this.setState('round_paused');

    this.io.to(this.code).emit(SERVER_EVENTS.GAME_ROUND_END, { scoringSide });

    const result = this.scoreManager.scorePoint(scoringSide);
    this.io.to(this.code).emit(SERVER_EVENTS.GAME_SCORE, {
      top: result.topScore,
      bottom: result.bottomScore,
    });

    if (result.matchOver) {
      this.stopTick();
      this.resetInputDirections();
      this.setState('match_over');
      const winner: Role = result.topScore > result.bottomScore ? 'host' : 'guest';
      this.io.to(this.code).emit(SERVER_EVENTS.MATCH_OVER, {
        winner,
        reason: 'normal',
        stats: this.scoreManager.getStats(),
      });

      // Nobody asked for a rematch in time — tell whoever is still here and clean up.
      this.rematchTimer = setTimeout(() => {
        this.rematchTimer = null;
        if (this.state !== 'match_over' || this.destroyed) return;
        this.io.to(this.code).emit(SERVER_EVENTS.ROOM_CLOSED, { reason: 'The room timed out.' });
        this.destroy();
      }, REMATCH_TIMEOUT_MS);
      return;
    }

    this.later(() => {
      if (this.state !== 'round_paused') return;
      this.runCountdownThenServe(result.nextServe);
    }, SERVER_PONG_CONFIG.pointPauseMs);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private createSlot(socket: Socket, role: Role, playerName: string, avatarDataUrl: string | null): PlayerSlot {
    return {
      socketId: socket.id,
      role,
      connected: true,
      paddleX: ARENA_WIDTH / 2,
      inputDirection: 0,
      targetX: null,
      moveDirection: 0,
      lastInputSeq: 0,
      playerName,
      avatarDataUrl,
      ready: false,
      rematchVote: false,
      reconnectToken: randomUUID(),
    };
  }

  private setState(state: RoomState) {
    this.state = state;
    this.io.to(this.code).emit(SERVER_EVENTS.MATCH_STATE_CHANGE, { state: MATCH_STATE[state] });
  }

  /** setTimeout that is tracked so it can be cancelled when the room pauses or dies. */
  private later(fn: () => void, ms: number) {
    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      fn();
    }, ms);
    this.pendingTimers.add(timer);
  }

  private clearPendingTimers() {
    this.pendingTimers.forEach(clearTimeout);
    this.pendingTimers.clear();
  }

  private centerPaddles() {
    if (this.host) this.host.paddleX = ARENA_WIDTH / 2;
    if (this.guest) this.guest.paddleX = ARENA_WIDTH / 2;
    this.resetInputDirections();
  }

  private resetInputDirections() {
    for (const player of [this.host, this.guest]) {
      if (!player) continue;
      player.inputDirection = 0;
      player.targetX = null;
    }
  }

  private getOpponent(player: PlayerSlot): PlayerSlot | null {
    return player.role === 'host' ? this.guest : this.host;
  }

  private getPlayerBySocket(socketId: string): PlayerSlot | null {
    if (this.host?.socketId === socketId) return this.host;
    if (this.guest?.socketId === socketId) return this.guest;
    return null;
  }
}
