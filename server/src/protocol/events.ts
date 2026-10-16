// ─── Shared protocol: event names + payload types ────────────────────────────
// This file is mirrored at src/protocol/events.ts for the client.
// Never import Phaser or Node-only modules here.

export type Role = 'host' | 'guest';
export type PaddleSide = 'top' | 'bottom';
export type ServeDirection = 'up' | 'down';
export type MatchState = 'lobby' | 'ready' | 'countdown' | 'playing' | 'point_scored' | 'match_over';

// ─── Client → Server ─────────────────────────────────────────────────────────

export const CLIENT_EVENTS = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  LOBBY_READY: 'lobby:ready',
  INPUT_UPDATE: 'input:update',
  MATCH_REMATCH: 'match:rematch',
  MATCH_EXIT: 'match:exit',
  MATCH_REJOIN: 'match:rejoin',
  PING: 'ping',
} as const;

export type RoomCreatePayload = {
  playerName: string;
  avatarDataUrl: string | null;
};

export type RoomJoinPayload = {
  code: string;
  playerName: string;
  avatarDataUrl: string | null;
};

export type InputUpdatePayload = {
  direction: -1 | 0 | 1;
  seq: number;
  /**
   * Touch/mouse control: the x position the paddle should glide towards.
   * When set it takes priority over direction. The server still caps speed.
   */
  targetX?: number | null;
};

export type MatchRejoinPayload = {
  token: string;
};

export type PingPayload = {
  clientTime: number;
};

// ─── Server → Client ─────────────────────────────────────────────────────────

export const SERVER_EVENTS = {
  ROOM_CREATED: 'room:created',
  ROOM_JOINED: 'room:joined',
  ROOM_OPPONENT_JOINED: 'room:opponent_joined',
  ROOM_OPPONENT_LEFT: 'room:opponent_left',
  ROOM_ERROR: 'room:error',
  LOBBY_OPPONENT_READY: 'lobby:opponent_ready',
  MATCH_START: 'match:start',
  GAME_STATE_SNAPSHOT: 'game:state_snapshot',
  GAME_SCORE: 'game:score',
  GAME_ROUND_START: 'game:round_start',
  GAME_ROUND_END: 'game:round_end',
  GAME_COUNTDOWN: 'game:countdown',
  MATCH_OVER: 'match:over',
  MATCH_REMATCH_VOTE: 'match:rematch_vote',
  MATCH_REMATCH_START: 'match:rematch_start',
  MATCH_REJOINED: 'match:rejoined',
  PLAYER_DISCONNECTED: 'player:disconnected',
  PLAYER_RECONNECTED: 'player:reconnected',
  MATCH_STATE_CHANGE: 'match:state_change',
  ROOM_CLOSED: 'room:closed',
  PONG: 'pong',
} as const;

export type RoomCreatedPayload = {
  code: string;
  role: Role;
  reconnectToken: string;
};

export type RoomJoinedPayload = {
  code: string;
  role: Role;
  opponentName: string;
  opponentAvatarUrl: string | null;
  reconnectToken: string;
};

export type RoomOpponentJoinedPayload = {
  opponentName: string;
  opponentAvatarUrl: string | null;
};

export type RoomErrorPayload = {
  message: string;
};

export type MatchStartPayload = {
  serveDirection: ServeDirection;
  hostIsTop: boolean;
};

/**
 * Sent every server tick while a match is running (including countdowns and
 * the pause after a point). Carries match state and score so a client that
 * missed a one-off event still converges on the truth.
 */
export type StateSnapshot = {
  seq: number;
  timestamp: number;
  state: MatchState;
  ball: { x: number; y: number; vx: number; vy: number };
  hostPaddleX: number;
  guestPaddleX: number;
  topScore: number;
  bottomScore: number;
};

export type GameScorePayload = {
  top: number;
  bottom: number;
};

export type GameRoundStartPayload = {
  serveDirection: ServeDirection;
  ballSpeed: number;
  countdown: boolean;
};

export type GameRoundEndPayload = {
  scoringSide: PaddleSide;
};

export type GameCountdownPayload = {
  value: string;
};

export type MatchOverPayload = {
  winner: Role | 'draw';
  reason?: 'normal' | 'opponent_disconnected';
  stats: {
    topScore: number;
    bottomScore: number;
    longestRally: number;
  };
};

export type MatchRematchVotePayload = {
  from: Role;
};

export type MatchRematchStartPayload = {
  serveDirection: ServeDirection;
};

export type MatchRejoinedPayload = {
  topScore: number;
  bottomScore: number;
};

export type PlayerDisconnectedPayload = {
  role: Role;
  reason: string;
  /** How long the server will wait for the player to come back. */
  graceMs: number;
};

export type PongPayload = {
  serverTime: number;
  clientTime: number;
};

export type MatchStateChangePayload = {
  state: MatchState;
};

export type RoomClosedPayload = {
  reason?: string;
};
