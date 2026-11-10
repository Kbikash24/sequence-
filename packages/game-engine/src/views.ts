import type { Card, PublicGameState } from "@sequence/shared";
import { countSequences } from "./sequences";
import type { GameState } from "./types";

export interface PublicViewOptions {
  connected?: Record<string, boolean>;
  turnDeadline?: number | null;
  turnDurationMs?: number | null;
  serverTime?: number;
}

/** Strips the deck order and all hands. Safe to broadcast to every client. */
export function toPublicState(
  state: GameState,
  options: PublicViewOptions = {},
): PublicGameState {
  return {
    gameId: state.id,
    version: state.version,
    mode: state.mode,
    status: state.status,
    chips: [...state.chips],
    sequences: state.sequences.map((s) => ({ ...s, cells: [...s.cells] })),
    players: state.players.map((p) => ({
      userId: p.userId,
      nickname: p.nickname,
      team: p.team,
      seat: p.seat,
      handCount: p.hand.length,
      connected: options.connected?.[p.userId] ?? true,
    })),
    currentSeat: state.currentSeat,
    turnNumber: state.turnNumber,
    deckCount: state.deck.length,
    discardCount: state.discard.length,
    recentDiscards: state.discard.slice(-5).map((c) => c.code),
    sequencesToWin: state.config.sequencesToWin,
    sequenceCounts: countSequences(state.sequences),
    winner: state.winner,
    finishReason: state.finishReason,
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    turnDeadline:
      state.status === "playing" ? (options.turnDeadline ?? null) : null,
    turnDurationMs: options.turnDurationMs ?? null,
    serverTime: options.serverTime ?? Date.now(),
    deadCardExchanged: state.deadCardExchanged,
    lastAction: state.lastAction ? { ...state.lastAction } : null,
    totalMoves: state.totalMoves,
  };
}

export function getPlayerHand(state: GameState, userId: string): Card[] {
  const player = state.players.find((p) => p.userId === userId);
  return player ? player.hand.map((c) => ({ ...c })) : [];
}
