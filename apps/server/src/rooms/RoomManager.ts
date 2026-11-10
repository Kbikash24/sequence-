import { randomUUID } from "node:crypto";
import {
  applyAction,
  createGame,
  forfeitTeam,
  getPlayerHand,
  resetGame,
  skipTurn,
  toPublicState,
  type GameState,
} from "@sequence/game-engine";
import {
  MODE_PLAYER_COUNT,
  TEAMS,
  cardLabel,
  cellLabel,
  type Ack,
  type ActionRequest,
  type ActivityEntry,
  type ChatMessage,
  type GameMode,
  type GuestUser,
  type PublicGameState,
  type RoomInfo,
  type RoomSnapshot,
  type Team,
} from "@sequence/shared";
import type { Logger } from "../services/logger";
import type { Persistence } from "../services/persistence";
import { generateRoomCode } from "./codes";
import { RoomError } from "./errors";
import type { AppServer, Room, RoomPlayer } from "./types";

export interface RoomManagerOptions {
  turnMs: number;
  reconnectMs: number;
  persistence: Persistence;
  logger: Logger;
}

const MAX_CHAT = 100;
const MAX_LOG = 200;
const MAX_PROCESSED = 256;

export const roomChannel = (code: string) => `room:${code}`;
export const userChannel = (userId: string) => `user:${userId}`;

const teamName = (team: Team) => (team === "red" ? "Red" : "Blue");

/**
 * Owns all room and game state. Every mutation runs synchronously on the event loop,
 * so each state transition is atomic; persistence is queued per room afterwards.
 */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly userRooms = new Map<string, string>();

  constructor(
    private readonly io: AppServer,
    private readonly options: RoomManagerOptions,
  ) {}

  // ---------- queries ----------

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  roomOf(userId: string): Room | undefined {
    const code = this.userRooms.get(userId);
    return code ? this.rooms.get(code) : undefined;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  capacity(room: Room): number {
    return MODE_PLAYER_COUNT[room.mode];
  }

  toRoomInfo(room: Room): RoomInfo {
    return {
      code: room.code,
      mode: room.mode,
      status: room.status,
      hostId: room.hostId,
      players: room.players.map((p) => ({
        userId: p.userId,
        nickname: p.nickname,
        team: p.team,
        ready: p.ready,
        connected: p.connected,
        isHost: p.userId === room.hostId,
      })),
      capacity: this.capacity(room),
      rematchVotes: [...room.rematchVotes],
      createdAt: room.createdAt,
    };
  }

  snapshot(room: Room, userId: string): RoomSnapshot {
    return {
      room: this.toRoomInfo(room),
      game: room.game ? this.publicState(room) : null,
      hand: room.game ? getPlayerHand(room.game, userId) : [],
      chat: [...room.chat],
      log: [...room.log],
      gameOver: room.gameOver,
      disconnects: Object.fromEntries(room.disconnectDeadlines),
    };
  }

  // ---------- room lifecycle ----------

  createRoom(user: GuestUser, mode: GameMode): RoomSnapshot {
    this.ensureCanSwitchRoom(user.id, null);
    const code = generateRoomCode((c) => this.rooms.has(c));
    const room: Room = {
      id: randomUUID(),
      code,
      mode,
      status: "lobby",
      hostId: user.id,
      players: [],
      createdAt: Date.now(),
      game: null,
      gameOver: null,
      turnDeadline: null,
      turnTimer: null,
      disconnectTimers: new Map(),
      disconnectDeadlines: new Map(),
      processed: new Map(),
      rematchVotes: new Set(),
      chat: [],
      log: [],
      persistChain: Promise.resolve(),
    };
    this.rooms.set(code, room);
    this.persist(room, (p) =>
      p.recordRoomCreated({ id: room.id, code, hostId: user.id, mode }),
    );
    this.addPlayer(room, user);
    this.options.logger.info("room created", { code, mode });
    return this.snapshot(room, user.id);
  }

  joinRoom(user: GuestUser, code: string): RoomSnapshot {
    const room = this.rooms.get(code);
    if (!room) throw new RoomError("NOT_FOUND", "Room not found");
    if (room.players.some((p) => p.userId === user.id)) {
      this.attach(room, user.id);
      return this.snapshot(room, user.id);
    }
    this.ensureCanSwitchRoom(user.id, code);
    if (room.status !== "lobby")
      throw new RoomError("GAME_IN_PROGRESS", "This game has already started");
    if (room.players.length >= this.capacity(room))
      throw new RoomError("ROOM_FULL", "This room is full");
    this.addPlayer(room, user);
    return this.snapshot(room, user.id);
  }

  leaveRoom(user: GuestUser): void {
    const room = this.requireRoom(user.id);
    const player = this.requirePlayer(room, user.id);
    if (room.status === "playing") {
      this.forfeit(
        room,
        player.team,
        "forfeit",
        `${player.nickname} left the game`,
      );
    }
    this.removePlayer(room, user.id);
  }

  setReady(user: GuestUser, ready: boolean): void {
    const room = this.requireRoom(user.id);
    this.requireStatus(room, "lobby");
    this.requirePlayer(room, user.id).ready = ready;
    this.broadcastRoom(room);
  }

  setTeam(user: GuestUser, team: Team): void {
    const room = this.requireRoom(user.id);
    this.requireStatus(room, "lobby");
    const player = this.requirePlayer(room, user.id);
    if (player.team === team) return;
    const perTeam = this.capacity(room) / 2;
    if (room.players.filter((p) => p.team === team).length >= perTeam) {
      throw new RoomError("TEAM_FULL", `${teamName(team)} team is full`);
    }
    player.team = team;
    player.ready = false;
    this.persist(room, (p) => p.recordRoomPlayer(room.id, user.id, team));
    this.broadcastRoom(room);
  }

  setMode(user: GuestUser, mode: GameMode): void {
    const room = this.requireRoom(user.id);
    this.requireHost(room, user.id);
    this.requireStatus(room, "lobby");
    if (room.mode === mode) return;
    if (room.players.length > MODE_PLAYER_COUNT[mode]) {
      throw new RoomError("TOO_MANY_PLAYERS", `Too many players for ${mode}`);
    }
    room.mode = mode;
    room.players.forEach((p, i) => {
      p.team = TEAMS[i % 2]!;
      p.ready = false;
    });
    this.addLog(room, "system", `Mode changed to ${mode}`);
    this.broadcastRoom(room);
  }

  startGame(user: GuestUser): void {
    const room = this.requireRoom(user.id);
    this.requireHost(room, user.id);
    this.requireStatus(room, "lobby");
    const capacity = this.capacity(room);
    if (room.players.length !== capacity) {
      throw new RoomError(
        "NOT_READY",
        `${room.mode} needs exactly ${capacity} players`,
      );
    }
    for (const team of TEAMS) {
      if (room.players.filter((p) => p.team === team).length !== capacity / 2) {
        throw new RoomError("NOT_READY", "Teams must be balanced");
      }
    }
    if (room.players.some((p) => !p.connected))
      throw new RoomError("NOT_READY", "Waiting for players to reconnect");
    if (room.players.some((p) => p.userId !== room.hostId && !p.ready)) {
      throw new RoomError("NOT_READY", "All players must be ready");
    }
    this.beginGame(room, null);
  }

  returnToLobby(user: GuestUser): void {
    const room = this.requireRoom(user.id);
    this.requireHost(room, user.id);
    this.requireStatus(room, "finished");
    room.status = "lobby";
    room.game = null;
    room.gameOver = null;
    room.turnDeadline = null;
    room.rematchVotes.clear();
    room.processed.clear();
    room.players.forEach((p) => (p.ready = false));
    this.addLog(room, "system", "Returned to lobby");
    this.persist(room, (p) => p.recordRoomStatus(room.id, "lobby"));
    this.broadcastRoom(room);
  }

  voteRematch(user: GuestUser, vote: boolean): void {
    const room = this.requireRoom(user.id);
    this.requireStatus(room, "finished");
    this.requirePlayer(room, user.id);
    if (vote) room.rematchVotes.add(user.id);
    else room.rematchVotes.delete(user.id);
    this.emitRematch(room);
    this.broadcastRoom(room);

    const capacity = this.capacity(room);
    const everyoneIn =
      room.players.length === capacity &&
      room.players.every((p) => p.connected && room.rematchVotes.has(p.userId));
    if (everyoneIn && room.game) this.beginGame(room, room.game);
  }

  sendChat(user: GuestUser, rawText: string): void {
    const room = this.requireRoom(user.id);
    const player = this.requirePlayer(room, user.id);
    const text = rawText.replace(/\p{Cc}/gu, "").trim();
    if (!text) throw new RoomError("INVALID_PAYLOAD", "Message is empty");
    const message: ChatMessage = {
      id: randomUUID(),
      userId: user.id,
      nickname: player.nickname,
      team: player.team,
      text,
      at: Date.now(),
    };
    room.chat.push(message);
    if (room.chat.length > MAX_CHAT)
      room.chat.splice(0, room.chat.length - MAX_CHAT);
    this.io.to(roomChannel(room.code)).emit("chat:message", message);
  }

  sync(user: GuestUser): RoomSnapshot {
    return this.snapshot(this.requireRoom(user.id), user.id);
  }

  // ---------- gameplay ----------

  handleAction(
    user: GuestUser,
    request: ActionRequest,
  ): Ack<{ version: number }> {
    const room = this.requireRoom(user.id);
    if (room.status !== "playing" || !room.game)
      throw new RoomError("GAME_NOT_ACTIVE", "No active game");

    const key = `${user.id}:${request.actionId}`;
    const cached = room.processed.get(key);
    if (cached) return cached;

    const game = room.game;
    if (request.expectedVersion !== game.version) {
      return {
        ok: false,
        code: "STALE_STATE",
        error: "Game state changed, please retry",
      };
    }

    const result = applyAction(game, user.id, request.action);
    if (!result.ok) {
      const response: Ack<{ version: number }> = {
        ok: false,
        code: "ILLEGAL_MOVE",
        error: result.error,
        details: { reason: result.code },
      };
      this.remember(room, key, response);
      return response;
    }

    const next = result.state;
    room.game = next;
    const response: Ack<{ version: number }> = {
      ok: true,
      data: { version: next.version },
    };
    this.remember(room, key, response);

    const { outcome } = result;
    const player = next.players.find((p) => p.userId === user.id)!;
    this.persist(room, (p) =>
      p.recordMove(next.id, {
        userId: user.id,
        version: next.version,
        type: outcome.type,
        card: outcome.card,
        cell: outcome.cell,
        sequencesFormed: outcome.newSequences.length,
      }),
    );
    this.logMove(
      room,
      player.nickname,
      player.team,
      outcome.type,
      outcome.card,
      outcome.cell,
    );
    const total = next.sequences.filter((s) => s.team === player.team).length;
    outcome.newSequences.forEach((_, i) => {
      const count = total - outcome.newSequences.length + i + 1;
      this.addLog(
        room,
        "sequence",
        `${teamName(player.team)} completed a sequence (${count}/${next.config.sequencesToWin})`,
        player.team,
      );
    });

    if (next.status === "finished") {
      this.finishGame(room);
    } else {
      // Dead-card exchange keeps the same turn, so keep its deadline.
      if (outcome.type !== "exchangeDead") this.startTurnTimer(room);
      this.broadcastGame(room);
    }
    return response;
  }

  // ---------- connection lifecycle ----------

  handleConnect(user: GuestUser): void {
    const room = this.roomOf(user.id);
    if (room) this.attach(room, user.id);
  }

  handleDisconnect(user: GuestUser): void {
    const room = this.roomOf(user.id);
    if (!room) return;
    const player = room.players.find((p) => p.userId === user.id);
    if (!player || !player.connected) return;
    player.connected = false;
    const deadline = Date.now() + this.options.reconnectMs;
    room.disconnectDeadlines.set(user.id, deadline);
    room.disconnectTimers.set(
      user.id,
      setTimeout(
        () => this.onReconnectExpired(room.code, user.id),
        this.options.reconnectMs,
      ),
    );
    this.io
      .to(roomChannel(room.code))
      .emit("player:disconnected", { userId: user.id, deadline });
    this.addLog(room, "system", `${player.nickname} disconnected`);
    this.broadcastRoom(room);
    if (room.game) this.broadcastGame(room);
  }

  shutdown(): void {
    for (const room of this.rooms.values()) this.clearTimers(room);
    this.rooms.clear();
    this.userRooms.clear();
  }

  // ---------- internals ----------

  private attach(room: Room, userId: string): void {
    this.io.in(userChannel(userId)).socketsJoin(roomChannel(room.code));
    const player = room.players.find((p) => p.userId === userId);
    if (!player || player.connected) return;
    player.connected = true;
    this.clearDisconnect(room, userId);
    this.io.to(roomChannel(room.code)).emit("player:reconnected", { userId });
    this.addLog(room, "system", `${player.nickname} reconnected`);
    this.broadcastRoom(room);
    if (room.game) this.broadcastGame(room);
  }

  private ensureCanSwitchRoom(userId: string, targetCode: string | null): void {
    const current = this.roomOf(userId);
    if (!current || current.code === targetCode) return;
    if (current.status === "playing") {
      throw new RoomError("IN_GAME", "You are already in an active game", {
        code: current.code,
      });
    }
    this.removePlayer(current, userId);
  }

  private addPlayer(room: Room, user: GuestUser): void {
    const perTeam = this.capacity(room) / 2;
    const red = room.players.filter((p) => p.team === "red").length;
    const blue = room.players.length - red;
    const team: Team = red <= blue && red < perTeam ? "red" : "blue";
    const player: RoomPlayer = {
      userId: user.id,
      nickname: user.nickname,
      team,
      ready: false,
      connected: true,
      joinedAt: Date.now(),
    };
    room.players.push(player);
    this.userRooms.set(user.id, room.code);
    this.io.in(userChannel(user.id)).socketsJoin(roomChannel(room.code));
    this.persist(room, (p) => p.recordRoomPlayer(room.id, user.id, team));
    this.addLog(room, "system", `${user.nickname} joined`, team);
    this.broadcastRoom(room);
  }

  private removePlayer(room: Room, userId: string): void {
    const index = room.players.findIndex((p) => p.userId === userId);
    if (index < 0) return;
    const [player] = room.players.splice(index, 1);
    this.clearDisconnect(room, userId);
    this.userRooms.delete(userId);
    room.rematchVotes.delete(userId);
    this.io.in(userChannel(userId)).socketsLeave(roomChannel(room.code));
    this.persist(room, (p) => p.recordRoomPlayerLeft(room.id, userId));

    if (room.players.length === 0) {
      this.destroyRoom(room);
      return;
    }
    this.addLog(room, "system", `${player!.nickname} left`);
    if (room.hostId === userId) {
      const next = room.players.find((p) => p.connected) ?? room.players[0]!;
      room.hostId = next.userId;
      this.addLog(room, "system", `${next.nickname} is now the host`);
      this.persist(room, (p) =>
        p.recordRoomStatus(room.id, room.status, next.userId),
      );
    }
    if (room.status === "finished") this.emitRematch(room);
    this.broadcastRoom(room);
  }

  private destroyRoom(room: Room): void {
    this.clearTimers(room);
    this.rooms.delete(room.code);
    this.io
      .to(roomChannel(room.code))
      .emit("room:closed", { reason: "Room closed" });
    this.persist(room, (p) => p.recordRoomStatus(room.id, "closed"));
    this.options.logger.info("room closed", { code: room.code });
  }

  private beginGame(room: Room, previous: GameState | null): void {
    const id = randomUUID();
    const game = previous
      ? resetGame(previous, { id })
      : createGame({
          id,
          mode: room.mode,
          players: room.players.map(({ userId, nickname, team }) => ({
            userId,
            nickname,
            team,
          })),
        });
    room.game = game;
    room.status = "playing";
    room.gameOver = null;
    room.rematchVotes.clear();
    room.processed.clear();
    room.log = [];
    const first = game.players[game.currentSeat]!;
    this.addLog(room, "system", previous ? "Rematch started" : "Game started");
    this.addLog(room, "turn", `${first.nickname} plays first`, first.team);
    this.startTurnTimer(room);
    this.persist(room, (p) => p.recordRoomStatus(room.id, "playing"));
    this.persist(room, (p) => p.recordGameStarted(room.id, game));
    this.broadcastRoom(room);
    this.broadcastGame(room);
  }

  private forfeit(
    room: Room,
    team: Team,
    reason: "forfeit" | "disconnect",
    message: string,
  ): void {
    if (!room.game || room.status !== "playing") return;
    room.game = forfeitTeam(room.game, team, reason);
    this.addLog(room, "system", message, team);
    this.finishGame(room);
  }

  private finishGame(room: Room): void {
    const game = room.game!;
    room.status = "finished";
    this.clearTurnTimer(room);
    room.turnDeadline = null;
    const winners = game.players.filter((p) => p.team === game.winner);
    room.gameOver = {
      gameId: game.id,
      winner: game.winner,
      reason: game.finishReason ?? "sequences",
      durationMs: Math.max(0, (game.endedAt ?? Date.now()) - game.startedAt),
      totalMoves: game.totalMoves,
      sequences: game.sequences,
      winners: winners.map((p) => ({ userId: p.userId, nickname: p.nickname })),
    };
    this.addLog(
      room,
      "system",
      game.winner
        ? `${teamName(game.winner)} team wins!`
        : "The game ended in a draw",
      game.winner,
    );
    this.persist(room, (p) => p.recordRoomStatus(room.id, "finished"));
    this.persist(room, (p) => p.recordGameFinished(game));
    this.broadcastRoom(room);
    this.broadcastGame(room);
    this.io.to(roomChannel(room.code)).emit("game:over", room.gameOver);
    this.emitRematch(room);
  }

  private startTurnTimer(room: Room): void {
    this.clearTurnTimer(room);
    const game = room.game;
    if (!game || game.status !== "playing") return;
    room.turnDeadline = Date.now() + this.options.turnMs;
    const { id, turnNumber } = game;
    room.turnTimer = setTimeout(
      () => this.onTurnTimeout(room.code, id, turnNumber),
      this.options.turnMs,
    );
  }

  private onTurnTimeout(
    code: string,
    gameId: string,
    turnNumber: number,
  ): void {
    const room = this.rooms.get(code);
    const game = room?.game;
    if (
      !room ||
      !game ||
      room.status !== "playing" ||
      game.id !== gameId ||
      game.turnNumber !== turnNumber
    )
      return;
    const player = game.players[game.currentSeat]!;
    const next = skipTurn(game);
    room.game = next;
    this.persist(room, (p) =>
      p.recordMove(next.id, {
        userId: player.userId,
        version: next.version,
        type: "timeout",
        sequencesFormed: 0,
      }),
    );
    this.addLog(
      room,
      "turn",
      `${player.nickname}'s turn timed out`,
      player.team,
    );
    if (next.status === "finished") {
      this.finishGame(room);
      return;
    }
    this.startTurnTimer(room);
    this.broadcastGame(room);
  }

  private onReconnectExpired(code: string, userId: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    const player = room.players.find((p) => p.userId === userId);
    if (!player || player.connected) return;
    if (room.status === "playing") {
      this.forfeit(
        room,
        player.team,
        "disconnect",
        `${player.nickname} did not reconnect in time`,
      );
    }
    this.removePlayer(room, userId);
  }

  private clearDisconnect(room: Room, userId: string): void {
    const timer = room.disconnectTimers.get(userId);
    if (timer) clearTimeout(timer);
    room.disconnectTimers.delete(userId);
    room.disconnectDeadlines.delete(userId);
  }

  private clearTurnTimer(room: Room): void {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }

  private clearTimers(room: Room): void {
    this.clearTurnTimer(room);
    for (const t of room.disconnectTimers.values()) clearTimeout(t);
    room.disconnectTimers.clear();
    room.disconnectDeadlines.clear();
  }

  private remember(
    room: Room,
    key: string,
    response: Ack<{ version: number }>,
  ): void {
    room.processed.set(key, response);
    if (room.processed.size > MAX_PROCESSED) {
      const oldest = room.processed.keys().next().value;
      if (oldest !== undefined) room.processed.delete(oldest);
    }
  }

  private publicState(room: Room): PublicGameState {
    const game = room.game!;
    const connected: Record<string, boolean> = {};
    for (const p of game.players) {
      connected[p.userId] =
        room.players.find((rp) => rp.userId === p.userId)?.connected ?? false;
    }
    return toPublicState(game, {
      connected,
      turnDeadline: room.turnDeadline,
      turnDurationMs: this.options.turnMs,
      serverTime: Date.now(),
    });
  }

  private broadcastRoom(room: Room): void {
    this.io
      .to(roomChannel(room.code))
      .emit("room:state", this.toRoomInfo(room));
  }

  private broadcastGame(room: Room): void {
    const game = room.game;
    if (!game) return;
    this.io
      .to(roomChannel(room.code))
      .emit("game:state", this.publicState(room));
    // Each hand goes only to its owner's private channel.
    for (const p of game.players) {
      if (!room.players.some((rp) => rp.userId === p.userId)) continue;
      this.io.to(userChannel(p.userId)).emit("game:hand", {
        gameId: game.id,
        version: game.version,
        cards: getPlayerHand(game, p.userId),
      });
    }
  }

  private emitRematch(room: Room): void {
    this.io
      .to(roomChannel(room.code))
      .emit("game:rematch", {
        votes: [...room.rematchVotes],
        required: this.capacity(room),
      });
  }

  private logMove(
    room: Room,
    nickname: string,
    team: Team,
    type: "place" | "remove" | "exchangeDead",
    card: Parameters<typeof cardLabel>[0],
    cell?: number,
  ): void {
    const label = cardLabel(card);
    const text =
      type === "place"
        ? `${nickname} played ${label} on ${cellLabel(cell!)}`
        : type === "remove"
          ? `${nickname} used ${label} to remove a chip at ${cellLabel(cell!)}`
          : `${nickname} exchanged dead card ${label}`;
    this.addLog(room, "move", text, team);
  }

  private addLog(
    room: Room,
    kind: ActivityEntry["kind"],
    text: string,
    team: Team | null = null,
  ): void {
    const entry: ActivityEntry = {
      id: randomUUID(),
      at: Date.now(),
      kind,
      text,
      team,
    };
    room.log.push(entry);
    if (room.log.length > MAX_LOG)
      room.log.splice(0, room.log.length - MAX_LOG);
    this.io.to(roomChannel(room.code)).emit("game:event", entry);
  }

  private persist(room: Room, task: (p: Persistence) => Promise<void>): void {
    room.persistChain = room.persistChain
      .then(() => task(this.options.persistence))
      .catch((err: unknown) => {
        this.options.logger.error("persistence failed", {
          room: room.code,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }

  private requireRoom(userId: string): Room {
    const room = this.roomOf(userId);
    if (!room) throw new RoomError("NOT_IN_ROOM", "You are not in a room");
    return room;
  }

  private requirePlayer(room: Room, userId: string): RoomPlayer {
    const player = room.players.find((p) => p.userId === userId);
    if (!player) throw new RoomError("NOT_IN_ROOM", "You are not in this room");
    return player;
  }

  private requireHost(room: Room, userId: string): void {
    if (room.hostId !== userId)
      throw new RoomError("NOT_HOST", "Only the host can do that");
  }

  private requireStatus(room: Room, status: Room["status"]): void {
    if (room.status !== status)
      throw new RoomError("INVALID_STATE", `Room must be in ${status}`);
  }
}
