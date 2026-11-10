import type { GameState } from "@sequence/game-engine";
import type {
  GameMode,
  GuestUser,
  RoomStatus,
  Team,
  UserStatsDTO,
} from "@sequence/shared";

export interface MoveRecord {
  userId: string;
  version: number;
  type: "place" | "remove" | "exchangeDead" | "timeout";
  card?: string;
  cell?: number;
  sequencesFormed: number;
}

/** Durable storage. Gameplay never waits on or fails because of persistence. */
export interface Persistence {
  upsertUser(user: GuestUser): Promise<void>;
  recordRoomCreated(room: {
    id: string;
    code: string;
    hostId: string;
    mode: GameMode;
  }): Promise<void>;
  recordRoomPlayer(roomId: string, userId: string, team: Team): Promise<void>;
  recordRoomPlayerLeft(roomId: string, userId: string): Promise<void>;
  recordRoomStatus(
    roomId: string,
    status: RoomStatus | "closed",
    hostId?: string,
  ): Promise<void>;
  recordGameStarted(roomId: string, state: GameState): Promise<void>;
  recordMove(gameId: string, move: MoveRecord): Promise<void>;
  recordGameFinished(state: GameState): Promise<void>;
  getUserStats(userId: string): Promise<UserStatsDTO | null>;
  close(): Promise<void>;
}

export class NoopPersistence implements Persistence {
  async upsertUser() {}
  async recordRoomCreated() {}
  async recordRoomPlayer() {}
  async recordRoomPlayerLeft() {}
  async recordRoomStatus() {}
  async recordGameStarted() {}
  async recordMove() {}
  async recordGameFinished() {}
  async getUserStats() {
    return null;
  }
  async close() {}
}
