import type { GameState } from "@sequence/game-engine";
import type {
  FriendsList,
  FriendStatus,
  GameMode,
  GuestUser,
  HeadToHead,
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
  getPlayerProfile(userId: string): Promise<{ nickname: string; createdAt: number; stats: UserStatsDTO } | null>;
  /** Null when the other player is unknown. */
  getHeadToHead(viewerId: string, otherId: string): Promise<HeadToHead | null>;
  getFriendStatus(viewerId: string, otherId: string): Promise<FriendStatus>;
  /** Sends a request, or accepts if the other player already asked. Null if the player is unknown. */
  sendFriendRequest(fromId: string, toId: string): Promise<FriendStatus | null>;
  /** Null when there is no pending request from `fromId`. */
  respondFriendRequest(
    userId: string,
    fromId: string,
    accept: boolean,
  ): Promise<FriendStatus | null>;
  /** Unfriends, cancels a sent request or declines a received one. */
  removeFriendship(userId: string, otherId: string): Promise<void>;
  listFriends(userId: string): Promise<FriendsList>;
  close(): Promise<void>;
}

export class FriendsUnavailableError extends Error {
  constructor() {
    super("Friends need the database, which is not configured");
  }
}

const unavailable = (): never => {
  throw new FriendsUnavailableError();
};

export class NoopPersistence implements Persistence {
  async upsertUser(_user: GuestUser) {}
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
  async getPlayerProfile() {
    return null;
  }
  async getHeadToHead() {
    return null;
  }
  async getFriendStatus(_viewerId: string, _otherId: string): Promise<FriendStatus> {
    return unavailable();
  }
  async sendFriendRequest(_fromId: string, _toId: string): Promise<FriendStatus | null> {
    return unavailable();
  }
  async respondFriendRequest(
    _userId: string,
    _fromId: string,
    _accept: boolean,
  ): Promise<FriendStatus | null> {
    return unavailable();
  }
  async removeFriendship(_userId: string, _otherId: string): Promise<void> {
    return unavailable();
  }
  async listFriends(_userId: string): Promise<FriendsList> {
    return unavailable();
  }
  async close() {}
}
