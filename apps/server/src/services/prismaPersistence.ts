import { PrismaClient, type GameMode as DbGameMode } from "@prisma/client";
import { countSequences, type GameState } from "@sequence/game-engine";
import type {
  GameMode,
  GuestUser,
  RoomStatus,
  Team,
  UserStatsDTO,
} from "@sequence/shared";
import type { MoveRecord, Persistence } from "./persistence";

const toDbMode = (mode: GameMode): DbGameMode =>
  mode === "1v1" ? "one_v_one" : "two_v_two";

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

  async close() {
    await this.prisma.$disconnect();
  }
}
