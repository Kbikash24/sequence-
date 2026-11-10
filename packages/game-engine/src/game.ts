import {
  MODE_PLAYER_COUNT,
  TEAMS,
  type GameAction,
  type GameMode,
  type FinishReason,
  type Sequence,
  type Team,
} from "@sequence/shared";
import { initializeBoard, placeChip, removeChip } from "./board";
import {
  createDeck,
  dealCards,
  secureRandomInt,
  shuffleDeck,
  type RandomInt,
} from "./deck";
import { validateMove } from "./rules";
import { countSequences, detectSequences } from "./sequences";
import type {
  ActionResult,
  EnginePlayer,
  GameConfig,
  GameState,
} from "./types";

export interface SeatInput {
  userId: string;
  nickname: string;
  team: Team;
}

export interface CreateGameOptions {
  id: string;
  mode: GameMode;
  players: SeatInput[];
  startingSeat?: number;
  rng?: RandomInt;
  now?: number;
  config?: Partial<GameConfig>;
}

export interface EngineOptions {
  rng?: RandomInt;
  now?: number;
}

export function defaultConfig(mode: GameMode): GameConfig {
  return {
    sequencesToWin: 2,
    handSize: mode === "1v1" ? 7 : 6,
    maxTurns: 1000,
  };
}

/** Orders players so teams alternate: red, blue, red, blue. */
export function orderSeats(
  mode: GameMode,
  players: readonly SeatInput[],
): SeatInput[] {
  const required = MODE_PLAYER_COUNT[mode];
  if (players.length !== required)
    throw new Error(`${mode} requires ${required} players`);
  const red = players.filter((p) => p.team === "red");
  const blue = players.filter((p) => p.team === "blue");
  if (red.length !== required / 2 || blue.length !== required / 2) {
    throw new Error("Teams must be balanced");
  }
  const seats: SeatInput[] = [];
  for (let i = 0; i < required / 2; i++) seats.push(red[i]!, blue[i]!);
  return seats;
}

export function createGame(options: CreateGameOptions): GameState {
  const rng = options.rng ?? secureRandomInt;
  const config = { ...defaultConfig(options.mode), ...options.config };
  const seats = orderSeats(options.mode, options.players);
  const { hands, deck } = dealCards(
    shuffleDeck(createDeck(), rng),
    seats.length,
    config.handSize,
  );
  const startingSeat = (options.startingSeat ?? 0) % seats.length;
  const players: EnginePlayer[] = seats.map((p, seat) => ({
    userId: p.userId,
    nickname: p.nickname,
    team: p.team,
    seat,
    hand: hands[seat]!,
  }));
  return {
    id: options.id,
    version: 0,
    mode: options.mode,
    config,
    players,
    deck,
    discard: [],
    chips: initializeBoard(),
    sequences: [],
    startingSeat,
    currentSeat: startingSeat,
    turnNumber: 1,
    status: "playing",
    winner: null,
    finishReason: null,
    deadCardExchanged: false,
    totalMoves: 0,
    startedAt: options.now ?? Date.now(),
    endedAt: null,
    lastAction: null,
  };
}

function clone(state: GameState): GameState {
  return structuredClone(state);
}

/** Draws the top card for a seat; reshuffles the discard pile when the deck is empty. */
export function drawCard(
  state: GameState,
  seat: number,
  rng: RandomInt = secureRandomInt,
): GameState {
  const next = clone(state);
  if (next.deck.length === 0 && next.discard.length > 0) {
    next.deck = shuffleDeck(next.discard, rng);
    next.discard = [];
  }
  const card = next.deck.shift();
  if (card) next.players[seat]!.hand.push(card);
  return next;
}

export function checkWinner(
  state: Pick<GameState, "sequences" | "config">,
): Team | null {
  const counts = countSequences(state.sequences);
  for (const team of TEAMS)
    if (counts[team] >= state.config.sequencesToWin) return team;
  return null;
}

/** Advances to the next seat and resets per-turn flags. */
export function nextTurn(
  state: GameState,
  now: number = Date.now(),
): GameState {
  const next = clone(state);
  if (next.status !== "playing") return next;
  next.currentSeat = (next.currentSeat + 1) % next.players.length;
  next.turnNumber += 1;
  next.deadCardExchanged = false;
  if (next.turnNumber > next.config.maxTurns) {
    next.status = "finished";
    next.finishReason = "stalemate";
    next.winner = null;
    next.endedAt = now;
  }
  return next;
}

/** Discards a dead card and draws a replacement. Does not end the turn. */
export function handleDeadCard(
  state: GameState,
  userId: string,
  cardId: string,
  options: EngineOptions = {},
): ActionResult {
  const check = validateMove(state, userId, { type: "exchangeDead", cardId });
  if (!check.ok) return check;
  const { player, card } = check;
  let next = clone(state);
  const hand = next.players[player.seat]!.hand;
  hand.splice(
    hand.findIndex((c) => c.id === card.id),
    1,
  );
  next.discard.push(card);
  next = drawCard(next, player.seat, options.rng);
  next.deadCardExchanged = true;
  next.version = state.version + 1;
  next.lastAction = {
    type: "exchangeDead",
    seat: player.seat,
    userId,
    card: card.code,
    at: options.now ?? Date.now(),
  };
  return {
    ok: true,
    state: next,
    outcome: {
      type: "exchangeDead",
      card: card.code,
      newSequences: [],
      winner: null,
    },
  };
}

/** Validates and applies a player action atomically, returning a new state. */
export function applyAction(
  state: GameState,
  userId: string,
  action: GameAction,
  options: EngineOptions = {},
): ActionResult {
  if (action.type === "exchangeDead")
    return handleDeadCard(state, userId, action.cardId, options);
  const check = validateMove(state, userId, action);
  if (!check.ok) return check;

  const now = options.now ?? Date.now();
  const { player, card } = check;
  let next = clone(state);
  const hand = next.players[player.seat]!.hand;
  hand.splice(
    hand.findIndex((c) => c.id === card.id),
    1,
  );
  next.discard.push(card);

  let newSequences: Sequence[] = [];
  if (action.type === "place") {
    next.chips = placeChip(next.chips, action.cell, player.team);
    newSequences = detectSequences(
      next.chips,
      next.sequences,
      player.team,
      action.cell,
    );
    next.sequences.push(...newSequences);
  } else {
    next.chips = removeChip(next.chips, action.cell);
  }

  next.totalMoves += 1;
  next.lastAction = {
    type: action.type,
    seat: player.seat,
    userId,
    card: card.code,
    cell: action.cell,
    sequencesFormed: newSequences.length,
    at: now,
  };

  const winner = checkWinner(next);
  if (winner) {
    next.status = "finished";
    next.winner = winner;
    next.finishReason = "sequences";
    next.endedAt = now;
  } else {
    next = drawCard(next, player.seat, options.rng);
    next = nextTurn(next, now);
  }
  next.version = state.version + 1;
  return {
    ok: true,
    state: next,
    outcome: {
      type: action.type,
      card: card.code,
      cell: action.cell,
      newSequences,
      winner,
    },
  };
}

/** Turn timeout: the current player forfeits this turn without drawing. */
export function skipTurn(
  state: GameState,
  now: number = Date.now(),
): GameState {
  if (state.status !== "playing") return state;
  const seat = state.currentSeat;
  const next = nextTurn(state, now);
  next.version = state.version + 1;
  next.lastAction = {
    type: "timeout",
    seat,
    userId: state.players[seat]!.userId,
    at: now,
  };
  return next;
}

/** Ends the game with the other team winning. */
export function forfeitTeam(
  state: GameState,
  losingTeam: Team,
  reason: Extract<FinishReason, "forfeit" | "disconnect">,
  now: number = Date.now(),
): GameState {
  if (state.status !== "playing") return state;
  const next = clone(state);
  next.status = "finished";
  next.winner = losingTeam === "red" ? "blue" : "red";
  next.finishReason = reason;
  next.endedAt = now;
  next.version = state.version + 1;
  return next;
}

/** New game with the same seats; the starting seat rotates. */
export function resetGame(
  state: GameState,
  options: { id: string } & EngineOptions,
): GameState {
  return createGame({
    id: options.id,
    mode: state.mode,
    players: state.players.map(({ userId, nickname, team }) => ({
      userId,
      nickname,
      team,
    })),
    startingSeat: (state.startingSeat + 1) % state.players.length,
    rng: options.rng,
    now: options.now,
    config: state.config,
  });
}
