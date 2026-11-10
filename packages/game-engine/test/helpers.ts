import type { CardCode, GameMode, Team } from "@sequence/shared";
import { createGame, type GameState, type RandomInt } from "../src";

/** Deterministic PRNG (mulberry32) for reproducible tests. */
export function seededRng(seed = 42): RandomInt {
  let a = seed >>> 0;
  return (max) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

export function newGame(mode: GameMode = "1v1", seed = 42): GameState {
  const players =
    mode === "1v1"
      ? [
          { userId: "r1", nickname: "Red", team: "red" as const },
          { userId: "b1", nickname: "Blue", team: "blue" as const },
        ]
      : [
          { userId: "r1", nickname: "Red1", team: "red" as const },
          { userId: "r2", nickname: "Red2", team: "red" as const },
          { userId: "b1", nickname: "Blue1", team: "blue" as const },
          { userId: "b2", nickname: "Blue2", team: "blue" as const },
        ];
  return createGame({
    id: "game-1",
    mode,
    players,
    rng: seededRng(seed),
    now: 1000,
  });
}

export const testCardId = (code: CardCode, i = 0) => `${code}-t${i}`;

export function withHand(
  state: GameState,
  seat: number,
  codes: CardCode[],
): GameState {
  const next = structuredClone(state);
  next.players[seat]!.hand = codes.map((code, i) => ({
    id: testCardId(code, i),
    code,
  }));
  return next;
}

export function withChips(
  state: GameState,
  team: Team,
  cells: number[],
): GameState {
  const next = structuredClone(state);
  for (const c of cells) next.chips[c] = team;
  return next;
}
