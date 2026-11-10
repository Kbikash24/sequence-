import {
  isJack,
  isOneEyedJack,
  isTwoEyedJack,
  type Card,
  type CardCode,
  type GameAction,
  type Sequence,
  type Team,
} from "@sequence/shared";
import {
  BOARD_LAYOUT,
  CELL_COUNT,
  getCardPositions,
  isCorner,
  isValidCell,
  type Chips,
} from "./board";
import { getLockedCells } from "./sequences";
import type {
  EngineError,
  EngineErrorCode,
  EnginePlayer,
  GameState,
} from "./types";

function fail(code: EngineErrorCode, error: string): EngineError {
  return { ok: false, code, error };
}

/** A non-jack card is dead when every matching board cell is occupied. */
export function isDeadCard(chips: Chips, code: CardCode): boolean {
  if (isJack(code)) return false;
  return getCardPositions(code).every((cell) => chips[cell] !== null);
}

/** Board cells the given card may legally target for `team`. */
export function getCardTargets(
  chips: Chips,
  sequences: readonly Sequence[],
  code: CardCode,
  team: Team,
): number[] {
  if (isTwoEyedJack(code)) {
    const cells: number[] = [];
    for (let i = 0; i < CELL_COUNT; i++)
      if (!isCorner(i) && chips[i] === null) cells.push(i);
    return cells;
  }
  if (isOneEyedJack(code)) {
    const locked = getLockedCells(sequences);
    const cells: number[] = [];
    for (let i = 0; i < CELL_COUNT; i++) {
      const chip = chips[i];
      if (chip !== null && chip !== team && !locked.has(i)) cells.push(i);
    }
    return cells;
  }
  return getCardPositions(code).filter((cell) => chips[cell] === null);
}

export type ValidMove = { ok: true; player: EnginePlayer; card: Card };

export function validateMove(
  state: GameState,
  userId: string,
  action: GameAction,
): ValidMove | EngineError {
  if (state.status !== "playing") return fail("GAME_OVER", "The game is over");
  const player = state.players.find((p) => p.userId === userId);
  if (!player) return fail("NOT_IN_GAME", "You are not a player in this game");
  if (player.seat !== state.currentSeat)
    return fail("NOT_YOUR_TURN", "It is not your turn");
  const card = player.hand.find((c) => c.id === action.cardId);
  if (!card) return fail("CARD_NOT_IN_HAND", "That card is not in your hand");

  if (action.type === "exchangeDead") {
    if (state.deadCardExchanged)
      return fail(
        "ALREADY_EXCHANGED",
        "You already exchanged a dead card this turn",
      );
    if (!isDeadCard(state.chips, card.code))
      return fail("NOT_DEAD", "That card is not dead");
    return { ok: true, player, card };
  }

  const { cell } = action;
  if (!isValidCell(cell) || isCorner(cell))
    return fail("INVALID_CELL", "Invalid board cell");

  if (action.type === "place") {
    if (isOneEyedJack(card.code))
      return fail(
        "WRONG_CARD_TYPE",
        "One-eyed jacks remove chips; they cannot place",
      );
    if (state.chips[cell] !== null)
      return fail("CELL_OCCUPIED", "That cell is already occupied");
    if (!isTwoEyedJack(card.code) && BOARD_LAYOUT[cell] !== card.code) {
      return fail("CARD_MISMATCH", "That card does not match this cell");
    }
    return { ok: true, player, card };
  }

  if (!isOneEyedJack(card.code))
    return fail("WRONG_CARD_TYPE", "Only one-eyed jacks can remove chips");
  const chip = state.chips[cell];
  if (chip === null) return fail("NO_CHIP", "There is no chip to remove");
  if (chip === player.team)
    return fail("OWN_CHIP", "You cannot remove your own chip");
  if (getLockedCells(state.sequences).has(cell)) {
    return fail(
      "LOCKED_CHIP",
      "Chips in a completed sequence cannot be removed",
    );
  }
  return { ok: true, player, card };
}
