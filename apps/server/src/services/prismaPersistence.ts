import { PrismaClient, type GameMode as DbGameMode } from "@prisma/client";
import { countSequences, type GameState } from "@sequence/game-engine";
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
import { buildHeadToHead, type SharedGameRow } from "./headToHead";
import type { MoveRecord, Persistence } from "./persistence";

const toDbMode = (mode: GameMode): DbGameMode =>
  mode === "1v1" ? "one_v_one" : "two_v_two";

const pairWhere = (a: string, b: string) => ({
  OR: [
    { requesterId: a, addresseeId: b },
    { requesterId: b, addresseeId: a },
  ],
});

const friendStatusOf = (
  row: { requesterId: string; status: "pending" | "accepted" } | null,
  viewerId: string,
): FriendStatus => {
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requesterId === viewerId ? "request_sent" : "request_received";
};

export class PrismaPersistence implements Persistence {
  constructor(private readonly prisma = new PrismaClient()) {}

  async connect() {
    await this.prisma.$connect();
  }

  async upsertUser(user: GuestUser) {
    await this.prisma.user.upsert({
      where: { id: user.id },
      create: { id: user.id, nickname: user.nickname },
      update: { nickname: user.nickname, lastSeenAt: new Date() },
    });
  }

  async recordRoomCreated(room: {
    id: string;
    code: string;
    hostId: string;
    mode: GameMode;
  }) {
    await this.prisma.room.create({
      data: {
        id: room.id,
        code: room.code,
        hostId: room.hostId,
        mode: toDbMode(room.mode),
      },
    });
  }

  async recordRoomPlayer(roomId: string, userId: string, team: Team) {
    await this.prisma.roomPlayer.upsert({
      where: { roomId_userId: { roomId, userId } },
      create: { roomId, userId, team },
      update: { team, leftAt: null },
    });
  }

  async recordRoomPlayerLeft(roomId: string, userId: string) {
    await this.prisma.roomPlayer.updateMany({
      where: { roomId, userId },
      data: { leftAt: new Date() },
    });
  }

  async recordRoomStatus(
    roomId: string,
    status: RoomStatus | "closed",
    hostId?: string,
  ) {
    await this.prisma.room.update({
      where: { id: roomId },
      data: {
        status,
        ...(hostId ? { hostId } : {}),
        ...(status === "closed" ? { closedAt: new Date() } : {}),
      },
    });
  }

  async recordGameStarted(roomId: string, state: GameState) {
    await this.prisma.game.create({
      data: {
        id: state.id,
        roomId,
        mode: toDbMode(state.mode),
        startedAt: new Date(state.startedAt),
        players: {
          create: state.players.map((p) => ({
            userId: p.userId,
            team: p.team,
            seat: p.seat,
          })),
        },
      },
    });
  }

  async recordMove(gameId: string, move: MoveRecord) {
    await this.prisma.gameMove.create({
      data: {
        gameId,
        userId: move.userId,
        version: move.version,
        type: move.type,
        card: move.card ?? null,
        cell: move.cell ?? null,
        sequencesFormed: move.sequencesFormed,
      },
    });
  }

  async recordGameFinished(state: GameState) {
    const endedAt = state.endedAt ?? Date.now();
    const counts = countSequences(state.sequences);
    await this.prisma.$transaction([
      this.prisma.game.update({
        where: { id: state.id },
        data: { status: "finished", endedAt: new Date(endedAt) },
      }),
      this.prisma.gameResult.create({
        data: {
          gameId: state.id,
          winnerTeam: state.winner,
          reason: state.finishReason ?? "forfeit",
          durationMs: Math.max(0, endedAt - state.startedAt),
          totalMoves: state.totalMoves,
          sequences: state.sequences.map((s) => ({
            team: s.team,
            cells: s.cells,
            direction: s.direction,
          })),
        },
      }),
      ...state.players.map((p) => {
        const win = state.winner === p.team ? 1 : 0;
        const draw = state.winner === null ? 1 : 0;
        const loss = 1 - win - draw;
        return this.prisma.userStats.upsert({
          where: { userId: p.userId },
          create: {
            userId: p.userId,
            gamesPlayed: 1,
            wins: win,
            losses: loss,
            draws: draw,
            sequencesCompleted: counts[p.team],
          },
          update: {
            gamesPlayed: { increment: 1 },
            wins: { increment: win },
            losses: { increment: loss },
            draws: { increment: draw },
            sequencesCompleted: { increment: counts[p.team] },
          },
        });
      }),
    ]);
  }

  async getUserStats(userId: string): Promise<UserStatsDTO | null> {
    const stats = await this.prisma.userStats.findUnique({ where: { userId } });
    if (!stats) return null;
    const { gamesPlayed, wins, losses, draws, sequencesCompleted } = stats;
    return { gamesPlayed, wins, losses, draws, sequencesCompleted };
  }

  async getPlayerProfile(userId: string): Promise<{ nickname: string; createdAt: number; stats: UserStatsDTO } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { stats: true },
    });
    if (!user) return null;
    const stats = user.stats ?? {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      sequencesCompleted: 0,
    };
    return {
      nickname: user.nickname,
      createdAt: user.createdAt.getTime(),
      stats,
    };
  }

  async getHeadToHead(
    viewerId: string,
    otherId: string,
  ): Promise<HeadToHead | null> {
    const other = await this.prisma.user.findUnique({
      where: { id: otherId },
      select: { id: true, nickname: true },
    });
    if (!other) return null;

    const games = await this.prisma.game.findMany({
      where: {
        status: "finished",
        result: { isNot: null },
        AND: [
          { players: { some: { userId: viewerId } } },
          { players: { some: { userId: otherId } } },
        ],
      },
      select: {
        id: true,
        mode: true,
        endedAt: true,
        startedAt: true,
        players: {
          where: { userId: { in: [viewerId, otherId] } },
          select: { userId: true, team: true },
        },
        result: { select: { winnerTeam: true, reason: true } },
      },
    });

    const rows: SharedGameRow[] = [];
    for (const g of games) {
      const viewer = g.players.find((p) => p.userId === viewerId);
      const them = g.players.find((p) => p.userId === otherId);
      if (!viewer || !them || !g.result) continue;
      rows.push({
        gameId: g.id,
        mode: g.mode === "one_v_one" ? "1v1" : "2v2",
        endedAt: (g.endedAt ?? g.startedAt).getTime(),
        reason: g.result.reason,
        winnerTeam: g.result.winnerTeam,
        viewerTeam: viewer.team,
        otherTeam: them.team,
      });
    }
    return buildHeadToHead(
      { userId: other.id, nickname: other.nickname },
      rows,
    );
  }

  async getFriendStatus(
    viewerId: string,
    otherId: string,
  ): Promise<FriendStatus> {
    return friendStatusOf(await this.findFriendship(viewerId, otherId), viewerId);
  }

  async sendFriendRequest(
    fromId: string,
    toId: string,
  ): Promise<FriendStatus | null> {
    const target = await this.prisma.user.findUnique({
      where: { id: toId },
      select: { id: true },
    });
    if (!target) return null;
    // Serializable so two players adding each other at once can't create two rows.
    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.friendship.findFirst({
          where: pairWhere(fromId, toId),
        });
        if (!existing) {
          await tx.friendship.create({
            data: { requesterId: fromId, addresseeId: toId },
          });
          return "request_sent";
        }
        if (existing.status === "pending" && existing.addresseeId === fromId) {
          await tx.friendship.update({
            where: { id: existing.id },
            data: { status: "accepted", respondedAt: new Date() },
          });
          return "friends";
        }
        return friendStatusOf(existing, fromId);
      },
      { isolationLevel: "Serializable" },
    );
  }

  async respondFriendRequest(
    userId: string,
    fromId: string,
    accept: boolean,
  ): Promise<FriendStatus | null> {
    const request = await this.prisma.friendship.findFirst({
      where: { requesterId: fromId, addresseeId: userId, status: "pending" },
    });
    if (!request) return null;
    if (accept) {
      await this.prisma.friendship.update({
        where: { id: request.id },
        data: { status: "accepted", respondedAt: new Date() },
      });
      return "friends";
    }
    await this.prisma.friendship.delete({ where: { id: request.id } });
    return "none";
  }

  async removeFriendship(userId: string, otherId: string): Promise<void> {
    await this.prisma.friendship.deleteMany({ where: pairWhere(userId, otherId) });
  }

  async listFriends(userId: string): Promise<FriendsList> {
    const rows = await this.prisma.friendship.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      orderBy: { createdAt: "desc" },
      include: {
        requester: { select: { id: true, nickname: true } },
        addressee: { select: { id: true, nickname: true } },
      },
    });
    const list: FriendsList = { friends: [], incoming: [], outgoing: [] };
    for (const row of rows) {
      const iAsked = row.requesterId === userId;
      const other = iAsked ? row.addressee : row.requester;
      const entry = { userId: other.id, nickname: other.nickname };
      if (row.status === "accepted") list.friends.push(entry);
      else (iAsked ? list.outgoing : list.incoming).push(entry);
    }
    list.friends.sort((a, b) => a.nickname.localeCompare(b.nickname));
    return list;
  }

  private findFriendship(a: string, b: string) {
    return this.prisma.friendship.findFirst({ where: pairWhere(a, b) });
  }

  async close() {
    await this.prisma.$disconnect();
  }
}
