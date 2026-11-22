import { randomUUID } from "node:crypto";
import type {
  Challenge,
  ChallengeOutcome,
  GuestUser,
  OnlineUser,
  PresenceStatus,
} from "@sequence/shared";
import { RoomError } from "../rooms/errors";
import { userChannel, type RoomManager } from "../rooms/RoomManager";
import type { AppServer } from "../rooms/types";

export const PRESENCE_CHANNEL = "presence";
const MAX_LISTED = 100;
const BROADCAST_DEBOUNCE_MS = 250;

export interface PresenceOptions {
  challengeTtlMs: number;
}

interface PendingChallenge extends Challenge {
  timer: NodeJS.Timeout;
}

/**
 * Tracks who is online and owns direct 1v1 challenges between them.
 * Challenges live in memory only; they are cancelled when either side goes offline.
 */
export class PresenceManager {
  private readonly online = new Map<string, GuestUser>();
  private readonly challenges = new Map<string, PendingChallenge>();
  private broadcastTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly io: AppServer,
    private readonly rooms: RoomManager,
    private readonly options: PresenceOptions,
  ) {
    rooms.onPresenceChange = () => this.scheduleBroadcast();
  }

  // ---------- presence ----------

  connect(user: GuestUser): void {
    this.online.set(user.id, user);
    this.scheduleBroadcast();
  }

  disconnect(userId: string): void {
    if (!this.online.delete(userId)) return;
    for (const c of [...this.challenges.values()]) {
      if (c.fromId === userId) this.resolve(c, "cancelled");
      else if (c.toId === userId) this.resolve(c, "offline");
    }
    this.scheduleBroadcast();
  }

  list(): OnlineUser[] {
    return [...this.online.values()]
      .map((u) => ({
        userId: u.id,
        nickname: u.nickname,
        status: this.statusOf(u.id),
      }))
      .sort((a, b) => a.nickname.localeCompare(b.nickname))
      .slice(0, MAX_LISTED);
  }

  watch(socketId: string, watching: boolean): OnlineUser[] {
    const socket = this.io.sockets.sockets.get(socketId);
    if (watching) void socket?.join(PRESENCE_CHANNEL);
    else void socket?.leave(PRESENCE_CHANNEL);
    return watching ? this.list() : [];
  }

  // ---------- challenges ----------

  send(from: GuestUser, toUserId: string): Challenge {
    const target = this.online.get(toUserId);
    if (toUserId === from.id)
      throw new RoomError("INVALID_STATE", "You can't challenge yourself");
    if (!target) throw new RoomError("USER_OFFLINE", "That player is offline");
    if (this.statusOf(from.id) === "in_game")
      throw new RoomError("USER_BUSY", "Finish your current game first");
    if (this.statusOf(target.id) === "in_game")
      throw new RoomError("USER_BUSY", `${target.nickname} is in a game`);
    for (const c of this.challenges.values()) {
      if (c.fromId === from.id)
        throw new RoomError(
          "CHALLENGE_EXISTS",
          "You already have a pending challenge",
        );
    }

    const id = randomUUID();
    const challenge: PendingChallenge = {
      id,
      fromId: from.id,
      fromNickname: from.nickname,
      toId: target.id,
      toNickname: target.nickname,
      expiresAt: Date.now() + this.options.challengeTtlMs,
      timer: setTimeout(() => {
        const pending = this.challenges.get(id);
        if (pending) this.resolve(pending, "expired");
      }, this.options.challengeTtlMs),
    };
    challenge.timer.unref();
    this.challenges.set(id, challenge);
    const payload = this.toPublic(challenge);
    this.io.to(userChannel(target.id)).emit("challenge:received", payload);
    return payload;
  }

  respond(
    user: GuestUser,
    challengeId: string,
    accept: boolean,
  ): { code: string | null } {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.toId !== user.id)
      throw new RoomError(
        "CHALLENGE_NOT_FOUND",
        "Challenge is no longer valid",
      );
    if (!accept) {
      this.resolve(challenge, "declined");
      return { code: null };
    }
    const challenger = this.online.get(challenge.fromId);
    if (!challenger) {
      this.resolve(challenge, "offline");
      throw new RoomError("USER_OFFLINE", "The challenger went offline");
    }
    let code: string;
    try {
      code = this.rooms.createChallengeRoom(challenger, user);
    } catch (err) {
      this.resolve(challenge, "cancelled");
      throw err;
    }
    this.resolve(challenge, "accepted", code);
    return { code };
  }

  cancel(user: GuestUser, challengeId: string): void {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.fromId !== user.id)
      throw new RoomError(
        "CHALLENGE_NOT_FOUND",
        "Challenge is no longer valid",
      );
    this.resolve(challenge, "cancelled");
  }

  shutdown(): void {
    for (const c of this.challenges.values()) clearTimeout(c.timer);
    this.challenges.clear();
    if (this.broadcastTimer) clearTimeout(this.broadcastTimer);
    this.broadcastTimer = null;
    this.rooms.onPresenceChange = null;
  }

  // ---------- internals ----------

  private resolve(
    challenge: PendingChallenge,
    outcome: ChallengeOutcome,
    code?: string,
  ): void {
    clearTimeout(challenge.timer);
    this.challenges.delete(challenge.id);
    this.io
      .to(userChannel(challenge.fromId))
      .to(userChannel(challenge.toId))
      .emit("challenge:resolved", { challengeId: challenge.id, outcome, code });
  }

  private toPublic({ timer: _timer, ...challenge }: PendingChallenge) {
    return challenge;
  }

  private statusOf(userId: string): PresenceStatus {
    const status = this.rooms.roomOf(userId)?.status;
    if (!status) return "available";
    return status === "playing" ? "in_game" : "in_lobby";
  }

  private scheduleBroadcast(): void {
    if (this.broadcastTimer) return;
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = null;
      this.io.to(PRESENCE_CHANNEL).emit("presence:update", this.list());
    }, BROADCAST_DEBOUNCE_MS);
    this.broadcastTimer.unref();
  }
}
