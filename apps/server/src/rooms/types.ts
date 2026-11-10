import type { Server } from "socket.io";
import type { GameState } from "@sequence/game-engine";
import type {
  Ack,
  ActivityEntry,
  ChatMessage,
  ClientToServerEvents,
  GameMode,
  GameOverPayload,
  GuestUser,
  RoomStatus,
  ServerToClientEvents,
  Team,
} from "@sequence/shared";

export interface SocketData {
  user: GuestUser;
}

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export interface RoomPlayer {
  userId: string;
  nickname: string;
  team: Team;
  ready: boolean;
  connected: boolean;
  joinedAt: number;
}

export interface Room {
  id: string;
  code: string;
  mode: GameMode;
  status: RoomStatus;
  hostId: string;
  players: RoomPlayer[];
  createdAt: number;
  game: GameState | null;
  gameOver: GameOverPayload | null;
  turnDeadline: number | null;
  turnTimer: NodeJS.Timeout | null;
  disconnectTimers: Map<string, NodeJS.Timeout>;
  disconnectDeadlines: Map<string, number>;
  /** Idempotency cache: `${userId}:${actionId}` -> response. */
  processed: Map<string, Ack<{ version: number }>>;
  rematchVotes: Set<string>;
  chat: ChatMessage[];
  log: ActivityEntry[];
  persistChain: Promise<void>;
}
