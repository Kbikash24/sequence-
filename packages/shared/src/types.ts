export const SUITS = ["S", "H", "D", "C"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "T",
  "J",
  "Q",
  "K",
] as const;
export type Rank = (typeof RANKS)[number];

export type CardCode = `${Rank}${Suit}`;

/** A physical card. `id` is unique across both decks, `code` is the face value. */
export interface Card {
  id: string;
  code: CardCode;
}

export type Team = "red" | "blue";
export const TEAMS: readonly Team[] = ["red", "blue"];

export type GameMode = "1v1" | "2v2";
export const GAME_MODES: readonly GameMode[] = ["1v1", "2v2"];
export const MODE_PLAYER_COUNT: Record<GameMode, number> = {
  "1v1": 2,
  "2v2": 4,
};

export type SequenceDirection = "H" | "V" | "D1" | "D2";

export interface Sequence {
  id: string;
  team: Team;
  cells: number[];
  direction: SequenceDirection;
}

export type GameAction =
  | { type: "place"; cardId: string; cell: number }
  | { type: "remove"; cardId: string; cell: number }
  | { type: "exchangeDead"; cardId: string };

export type GameStatus = "playing" | "finished";
export type FinishReason = "sequences" | "forfeit" | "disconnect" | "stalemate";

export interface LastAction {
  type: "place" | "remove" | "exchangeDead" | "timeout";
  seat: number;
  userId: string;
  card?: CardCode;
  cell?: number;
  sequencesFormed?: number;
  at: number;
}

export interface PublicPlayer {
  userId: string;
  nickname: string;
  team: Team;
  seat: number;
  handCount: number;
  connected: boolean;
}

/** Game state that is safe to broadcast: no deck order, no hands. */
export interface PublicGameState {
  gameId: string;
  version: number;
  mode: GameMode;
  status: GameStatus;
  chips: (Team | null)[];
  sequences: Sequence[];
  players: PublicPlayer[];
  currentSeat: number;
  turnNumber: number;
  deckCount: number;
  discardCount: number;
  recentDiscards: CardCode[];
  sequencesToWin: number;
  sequenceCounts: Record<Team, number>;
  winner: Team | null;
  finishReason: FinishReason | null;
  startedAt: number;
  endedAt: number | null;
  turnDeadline: number | null;
  turnDurationMs: number | null;
  serverTime: number;
  deadCardExchanged: boolean;
  lastAction: LastAction | null;
  totalMoves: number;
}

export type RoomStatus = "lobby" | "playing" | "finished";

export interface RoomPlayerInfo {
  userId: string;
  nickname: string;
  team: Team;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
}

export interface RoomInfo {
  code: string;
  mode: GameMode;
  status: RoomStatus;
  hostId: string;
  players: RoomPlayerInfo[];
  capacity: number;
  rematchVotes: string[];
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  nickname: string;
  team: Team | null;
  text: string;
  at: number;
}

export interface ActivityEntry {
  id: string;
  at: number;
  kind: "move" | "sequence" | "system" | "turn";
  text: string;
  team?: Team | null;
}

export interface GameOverPayload {
  gameId: string;
  winner: Team | null;
  reason: FinishReason;
  durationMs: number;
  totalMoves: number;
  sequences: Sequence[];
  winners: { userId: string; nickname: string }[];
}

export interface GuestUser {
  id: string;
  nickname: string;
}

export interface UserStatsDTO {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  sequencesCompleted: number;
}

export interface HandPayload {
  gameId: string;
  version: number;
  cards: Card[];
}

export interface RoomSnapshot {
  room: RoomInfo;
  game: PublicGameState | null;
  hand: Card[];
  chat: ChatMessage[];
  log: ActivityEntry[];
  gameOver: GameOverPayload | null;
  disconnects: Record<string, number>;
}

export type ErrorCode =
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "INVALID_PAYLOAD"
  | "NOT_FOUND"
  | "ROOM_FULL"
  | "TEAM_FULL"
  | "IN_GAME"
  | "GAME_IN_PROGRESS"
  | "NOT_IN_ROOM"
  | "NOT_HOST"
  | "NOT_READY"
  | "INVALID_STATE"
  | "TOO_MANY_PLAYERS"
  | "STALE_STATE"
  | "GAME_NOT_ACTIVE"
  | "ILLEGAL_MOVE"
  | "INTERNAL";

export type Ack<T = null> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      code?: ErrorCode;
      details?: Record<string, string>;
    };
