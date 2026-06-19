import type { Server, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import {
  SERVER_EVENTS,
  type Role,
  type MatchState,
  type ServeDirection,
  type StateSnapshot,
} from '../protocol/events.js';
import { ServerBallSimulator, SERVER_PONG_CONFIG } from '../game/ServerBallSimulator.js';
import { ServerScoreManager } from '../game/ServerScoreManager.js';

// Fixed arena dimensions — matches the CSS game-shell max size
const ARENA_WIDTH = 800;
const ARENA_HEIGHT = 600;
const TICK_RATE_HZ = 60;
const TICK_MS = 1000 / TICK_RATE_HZ;

const REMATCH_TIMEOUT_MS = 30_000;

export type PlayerSlot = {
  socketId: string;
  role: Role;
  paddleX: number;
  inputDirection: -1 | 0 | 1;
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
  | 'active'        // tick loop running
  | 'round_paused'  // point scored, brief pause
  | 'match_over'    // match finished
  | 'disconnected'; // one player disconnected, grace window open

export class Room {
  readonly code: string;
  host: PlayerSlot | null = null;
  guest: PlayerSlot | null = null;
  state: RoomState = 'waiting';

  private ball: ServerBallSimulator;
  private scoreManager: ServerScoreManager;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private pendingTimers: ReturnType<typeof setTimeout>[] = [];
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private rematchTimer: ReturnType<typeof setTimeout> | null = null;
  private tickSeq = 0;
  private lastTickTime = 0;
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
    this.host = {
      socketId: socket.id,
      role: 'host',
      paddleX: ARENA_WIDTH / 2,
      inputDirection: 0,
      lastInputSeq: 0,
      playerName,
      avatarDataUrl,
      ready: false,
      rematchVote: false,
      reconnectToken: randomUUID(),
    };
    socket.join(this.code);
  }

  addGuest(socket: Socket, playerName: string, avatarDataUrl: string | null) {
    this.guest = {
      socketId: socket.id,
      role: 'guest',
      paddleX: ARENA_WIDTH / 2,
      inputDirection: 0,
      lastInputSeq: 0,
      playerName,
      avatarDataUrl,
      ready: false,
      rematchVote: false,
      reconnectToken: randomUUID(),
    };
    socket.join(this.code);
    this.state = 'ready_check';
  }

  setReady(socketId: string) {
    const player = this.getPlayerBySocket(socketId);
    if (!player || this.state !== 'ready_check') return;
    player.ready = true;

    // Notify opponent
    const opponent = player.role === 'host' ? this.guest : this.host;
    if (opponent) {
      this.io.to(opponent.socketId).emit(SERVER_EVENTS.LOBBY_OPPONENT_READY);
    }

    if (this.host?.ready && this.guest?.ready) {
      this.startMatch();
    }
  }

  handleInput(socketId: string, direction: -1 | 0 | 1, seq: number) {
    // Only accept input during active gameplay
    if (this.state !== 'active') return;
    const player = this.getPlayerBySocket(socketId);
    if (!player) return;
    player.inputDirection = direction;
    player.lastInputSeq = seq;
  }

  handleDisconnect(socketId: string) {
    const player = this.getPlayerBySocket(socketId);
    if (!player) return;

    const opponent = player.role === 'host' ? this.guest : this.host;

    // If lobby stages — simple cleanup
    if (this.state === 'waiting' || this.state === 'ready_check') {
      if (opponent) {
        this.io.to(opponent.socketId).emit(SERVER_EVENTS.ROOM_ERROR, { message: 'Opponent left the lobby.' });
      }
      this.destroy();
      return;
    }

    // Mid-game: handle depending on role
    if (this.state === 'active' || this.state === 'round_paused' || this.state === 'countdown') {
      this.stopTick();
      
      if (player.role === 'host') {
        // Host disconnects -> room closed immediately
        if (opponent) {
          this.io.to(opponent.socketId).emit(SERVER_EVENTS.ROOM_CLOSED, { reason: 'Host disconnected' });
        }
        this.destroy();
        return;
      }

      // Guest disconnects -> open grace window
      this.state = 'disconnected';
      if (opponent) {
        this.io.to(opponent.socketId).emit(SERVER_EVENTS.PLAYER_DISCONNECTED, {
          role: player.role,
          reason: 'transport close',
        });
      }

      this.disconnectTimer = setTimeout(() => {
        // Grace expired — opponent wins
        if (opponent) {
          const winnerRole: Role = opponent.role;
          this.io.to(opponent.socketId).emit(SERVER_EVENTS.MATCH_OVER, {
            winner: winnerRole,
            reason: 'opponent_disconnected',
            stats: this.scoreManager.getStats(),
          });
        }
        this.destroy();
      }, 15_000); // 15s grace
      this.pendingTimers.push(this.disconnectTimer);
    }

    // Match over stage — just destroy
    if (this.state === 'match_over') {
      this.destroy();
    }
  }

  handleRejoin(socket: Socket, token: string) {
    const player = this.getPlayerByToken(token);
    if (!player || this.state !== 'disconnected') return;

    // Clear grace timer
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    player.socketId = socket.id;
    socket.join(this.code);

    // Send current state to rejoining player
    socket.emit(SERVER_EVENTS.GAME_SCORE, {
      top: this.scoreManager.getTopScore(),
      bottom: this.scoreManager.getBottomScore(),
    });

    // Notify opponent
    const opponent = player.role === 'host' ? this.guest : this.host;
    if (opponent) {
      this.io.to(opponent.socketId).emit(SERVER_EVENTS.PLAYER_RECONNECTED);
    }

    // Resume through countdown instead of jumping straight to active
    this.resetInputDirections();
    const serveDir: ServeDirection = Math.random() < 0.5 ? 'down' : 'up';
    this.runCountdownThenServe(serveDir);
  }

  handleRematch(socketId: string) {
    const player = this.getPlayerBySocket(socketId);
    if (!player || this.state !== 'match_over') return;
    player.rematchVote = true;

    const opponent = player.role === 'host' ? this.guest : this.host;
    if (opponent) {
      this.io.to(opponent.socketId).emit(SERVER_EVENTS.MATCH_REMATCH_VOTE, { from: player.role });
    }

    if (this.host?.rematchVote && this.guest?.rematchVote) {
      if (this.rematchTimer) {
        clearTimeout(this.rematchTimer);
        this.rematchTimer = null;
      }
      this.scoreManager.reset();
      if (this.host) this.host.rematchVote = false;
      if (this.guest) this.guest.rematchVote = false;
      const serveDir = Math.random() < 0.5 ? 'down' : 'up';
      this.io.to(this.code).emit(SERVER_EVENTS.MATCH_REMATCH_START, { serveDirection: serveDir });
      this.runCountdownThenServe(serveDir as ServeDirection);
    }
  }

  handleExit(socketId: string) {
    const player = this.getPlayerBySocket(socketId);
    if (!player) return;
    const opponent = player.role === 'host' ? this.guest : this.host;
    if (opponent) {
      this.io.to(opponent.socketId).emit(SERVER_EVENTS.PLAYER_DISCONNECTED, { role: player.role, reason: 'exit' });
    }
    this.destroy();
  }

  isFull(): boolean {
    return this.host !== null && this.guest !== null;
  }

  clearAllTimers() {
    this.pendingTimers.forEach(clearTimeout);
    this.pendingTimers = [];
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
    if (this.rematchTimer) {
      clearTimeout(this.rematchTimer);
      this.rematchTimer = null;
    }
  }

  destroy() {
    this.state = 'match_over'; // prevent timer callbacks
    this.stopTick();
    this.clearAllTimers();
    this.onDestroy(this.code);
  }

  // ─── Match flow ───────────────────────────────────────────────────────────

  private startMatch() {
    this.scoreManager.reset();
    this.ball.reset();
    this.state = 'countdown';
    this.broadcastMatchState();

    const serveDir: ServeDirection = Math.random() < 0.5 ? 'down' : 'up';

    this.io.to(this.code).emit(SERVER_EVENTS.MATCH_START, {
      serveDirection: serveDir,
      hostIsTop: true, // host always top paddle
    });

    this.runCountdownThenServe(serveDir);
  }

  private runCountdownThenServe(serveDir: ServeDirection) {
    this.state = 'countdown';
    this.broadcastMatchState();
    this.resetInputDirections();
    const ticks = ['3', '2', '1', 'GO'];
    let idx = 0;

    const tick = () => {
      if (this.state === 'match_over') return;
      if (idx < ticks.length) {
        this.io.to(this.code).emit(SERVER_EVENTS.GAME_COUNTDOWN, { value: ticks[idx] });
        idx++;
        this.pendingTimers.push(setTimeout(tick, SERVER_PONG_CONFIG.countdownMs));
      } else {
        this.startRound(serveDir);
      }
    };
    tick();
  }

  private startRound(serveDir: ServeDirection) {
    this.ball.reset();
    this.ball.speed = this.scoreManager.getCurrentBallSpeed();
    const seed = Date.now() % 1000;
    this.ball.serve(serveDir, seed);

    this.io.to(this.code).emit(SERVER_EVENTS.GAME_ROUND_START, {
      serveDirection: serveDir,
      ballSpeed: this.ball.speed,
      countdown: false,
    });

    this.state = 'active';
    this.broadcastMatchState();
    this.lastTickTime = Date.now();
    this.startTick();
  }

  // ─── Tick loop ────────────────────────────────────────────────────────────

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
    if (this.state !== 'active') return;

    const now = Date.now();
    const delta = now - this.lastTickTime;
    this.lastTickTime = now;

    // Apply paddle inputs
    const paddleSpeed = SERVER_PONG_CONFIG.paddle.speed;
    const paddleHalfWidth = SERVER_PONG_CONFIG.paddle.width / 2;
    const leftLimit = SERVER_PONG_CONFIG.arenaPadding + paddleHalfWidth;
    const rightLimit = ARENA_WIDTH - SERVER_PONG_CONFIG.arenaPadding - paddleHalfWidth;

    if (this.host) {
      this.host.paddleX += this.host.inputDirection * paddleSpeed * (delta / 1000);
      this.host.paddleX = Math.max(leftLimit, Math.min(rightLimit, this.host.paddleX));
    }
    if (this.guest) {
      this.guest.paddleX += this.guest.inputDirection * paddleSpeed * (delta / 1000);
      this.guest.paddleX = Math.max(leftLimit, Math.min(rightLimit, this.guest.paddleX));
    }

    // Advance ball
    this.ball.step(delta);

    // Check paddle collisions
    this.checkPaddleCollisions();

    // Check out of bounds
    const scoringSide = this.ball.checkOutOfBounds();
    if (scoringSide) {
      this.handlePoint(scoringSide);
      return;
    }

    // Broadcast snapshot
    this.tickSeq++;
    const snapshot: StateSnapshot = {
      seq: this.tickSeq,
      ball: this.ball.getState(),
      hostPaddleX: this.host?.paddleX ?? ARENA_WIDTH / 2,
      guestPaddleX: this.guest?.paddleX ?? ARENA_WIDTH / 2,
      lastAckedInputSeq: 0, // will be per-player in future; kept simple for now
      timestamp: now,
    };
    this.io.to(this.code).emit(SERVER_EVENTS.GAME_STATE_SNAPSHOT, snapshot);
  }

  private checkPaddleCollisions() {
    const radius = SERVER_PONG_CONFIG.ball.radius;
    const topPaddleY = SERVER_PONG_CONFIG.paddle.topOffset;
    const bottomPaddleY = ARENA_HEIGHT - SERVER_PONG_CONFIG.paddle.bottomOffset;
    const paddleHalfHeight = SERVER_PONG_CONFIG.paddle.height / 2;

    // Top paddle (host)
    if (
      this.host &&
      this.ball.vy < 0 &&
      this.ball.y - radius <= topPaddleY + paddleHalfHeight &&
      this.ball.y - radius >= topPaddleY - paddleHalfHeight - radius &&
      Math.abs(this.ball.x - this.host.paddleX) <= SERVER_PONG_CONFIG.paddle.width / 2 + radius
    ) {
      this.ball.y = topPaddleY + paddleHalfHeight + radius;
      const newSpeed = this.scoreManager.registerPaddleHit();
      this.ball.setSpeed(newSpeed);
      this.ball.bounceFromPaddle(this.host.paddleX, SERVER_PONG_CONFIG.paddle.width, 'top');
    }

    // Bottom paddle (guest)
    if (
      this.guest &&
      this.ball.vy > 0 &&
      this.ball.y + radius >= bottomPaddleY - paddleHalfHeight &&
      this.ball.y + radius <= bottomPaddleY + paddleHalfHeight + radius &&
      Math.abs(this.ball.x - this.guest.paddleX) <= SERVER_PONG_CONFIG.paddle.width / 2 + radius
    ) {
      this.ball.y = bottomPaddleY - paddleHalfHeight - radius;
      const newSpeed = this.scoreManager.registerPaddleHit();
      this.ball.setSpeed(newSpeed);
      this.ball.bounceFromPaddle(this.guest.paddleX, SERVER_PONG_CONFIG.paddle.width, 'bottom');
    }
  }

  private handlePoint(scoringSide: 'top' | 'bottom') {
    this.stopTick();
    this.state = 'round_paused';
    this.broadcastMatchState();
    this.resetInputDirections();

    this.io.to(this.code).emit(SERVER_EVENTS.GAME_ROUND_END, { scoringSide });

    const result = this.scoreManager.scorePoint(scoringSide);
    this.io.to(this.code).emit(SERVER_EVENTS.GAME_SCORE, {
      top: result.topScore,
      bottom: result.bottomScore,
    });

    if (result.matchOver) {
      this.state = 'match_over';
      this.broadcastMatchState();
      const winner: Role = result.topScore > result.bottomScore ? 'host' : 'guest';
      this.io.to(this.code).emit(SERVER_EVENTS.MATCH_OVER, {
        winner,
        reason: 'normal',
        stats: this.scoreManager.getStats(),
      });

      // Auto-destroy room after rematch timeout
      this.rematchTimer = setTimeout(() => {
        if (this.state !== 'match_over') return;
        this.destroy();
      }, REMATCH_TIMEOUT_MS);
      this.pendingTimers.push(this.rematchTimer);
      return;
    }

    // Pause then start next round
    const timer = setTimeout(() => {
      if (this.state !== 'round_paused') return;
      this.runCountdownThenServe(result.nextServe);
    }, SERVER_PONG_CONFIG.pointPauseMs);
    this.pendingTimers.push(timer);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  // ─── State broadcast helpers ──────────────────────────────────────────────

  private broadcastMatchState() {
    const stateMap: Record<RoomState, MatchState> = {
      'waiting': 'lobby',
      'ready_check': 'ready',
      'countdown': 'countdown',
      'active': 'playing',
      'round_paused': 'point_scored',
      'match_over': 'match_over',
      'disconnected': 'playing', // client shows disconnect overlay independently
    };
    this.io.to(this.code).emit(SERVER_EVENTS.MATCH_STATE_CHANGE, {
      state: stateMap[this.state],
    });
  }

  private resetInputDirections() {
    if (this.host) this.host.inputDirection = 0;
    if (this.guest) this.guest.inputDirection = 0;
  }

  private getPlayerBySocket(socketId: string): PlayerSlot | null {
    if (this.host?.socketId === socketId) return this.host;
    if (this.guest?.socketId === socketId) return this.guest;
    return null;
  }



  getPlayerByToken(token: string): PlayerSlot | null {
    if (this.host?.reconnectToken === token) return this.host;
    if (this.guest?.reconnectToken === token) return this.guest;
    return null;
  }
}
