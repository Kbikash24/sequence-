import type {
  Card,
  CardCode,
  FinishReason,
  GameMode,
  GameStatus,
  LastAction,
  Sequence,
  Team,
} from "@sequence/shared";
import type { Chips } from "./board";

export interface GameConfig {
  sequencesToWin: number;
  handSize: number;
  /** Safety valve: game ends in a draw after this many turns. */
  maxTurns: number;
}

export interface EnginePlayer {
  userId: string;
  nickname: string;
  team: Team;
  seat: number;
  hand: Card[];
}

export interface GameState {
  id: string;
  version: number;
  mode: GameMode;
  config: GameConfig;
  players: EnginePlayer[];
  deck: Card[];
  discard: Card[];
  chips: Chips;
  sequences: Sequence[];
  startingSeat: number;
  currentSeat: number;
  turnNumber: number;
  status: GameStatus;
  winner: Team | null;
  finishReason: FinishReason | null;
  deadCardExchanged: boolean;
  totalMoves: number;
  startedAt: number;
  endedAt: number | null;
  lastAction: LastAction | null;
}

export type EngineErrorCode =
  | "GAME_OVER"
  | "NOT_IN_GAME"
  | "NOT_YOUR_TURN"
  | "CARD_NOT_IN_HAND"
  | "INVALID_CELL"
  | "CELL_OCCUPIED"
  | "CARD_MISMATCH"
  | "WRONG_CARD_TYPE"
  | "NO_CHIP"
  | "OWN_CHIP"
  | "LOCKED_CHIP"
  | "NOT_DEAD"
  | "ALREADY_EXCHANGED";

export interface EngineError {
  ok: false;
  code: EngineErrorCode;
  error: string;
}

export interface ActionOutcome {
  type: "place" | "remove" | "exchangeDead";
  card: CardCode;
  cell?: number;
  newSequences: Sequence[];
  winner: Team | null;
}

export type ActionResult =
  | { ok: true; state: GameState; outcome: ActionOutcome }
  | EngineError;
