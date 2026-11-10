import { describe, expect, it } from "vitest";
import { isJack, type CardCode } from "@sequence/shared";
import {
  BOARD_LAYOUT,
  CORNER_CELLS,
  FREE_CELL,
  createDeck,
  createGame,
  dealCards,
  getCardPositions,
  initializeBoard,
  secureRandomInt,
  shuffleDeck,
} from "../src";
import { newGame, seededRng } from "./helpers";

describe("board", () => {
  it("has 100 cells with 4 free corners", () => {
    expect(BOARD_LAYOUT).toHaveLength(100);
    expect(CORNER_CELLS.map((c) => BOARD_LAYOUT[c])).toEqual([
      FREE_CELL,
      FREE_CELL,
      FREE_CELL,
      FREE_CELL,
    ]);
    expect(BOARD_LAYOUT.filter((c) => c === FREE_CELL)).toHaveLength(4);
  });

  it("places every non-jack card exactly twice and no jacks", () => {
    const counts = new Map<CardCode, number>();
    for (const card of BOARD_LAYOUT) {
      if (card === FREE_CELL) continue;
      expect(isJack(card)).toBe(false);
      counts.set(card, (counts.get(card) ?? 0) + 1);
    }
    const nonJacks = new Set(
      createDeck(1)
        .map((c) => c.code)
        .filter((c) => !isJack(c)),
    );
    expect(counts.size).toBe(48);
    for (const code of nonJacks) {
      expect(counts.get(code)).toBe(2);
      expect(getCardPositions(code)).toHaveLength(2);
    }
  });

  it("initializes an empty chip board", () => {
    expect(initializeBoard().every((c) => c === null)).toBe(true);
  });
});

describe("deck", () => {
  it("creates two decks without jokers", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(104);
    expect(new Set(deck.map((c) => c.id)).size).toBe(104);
    expect(deck.filter((c) => isJack(c.code))).toHaveLength(8);
  });

  it("shuffles without losing cards", () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck, seededRng(7));
    expect(shuffled).toHaveLength(104);
    expect(new Set(shuffled.map((c) => c.id))).toEqual(
      new Set(deck.map((c) => c.id)),
    );
    expect(shuffled.map((c) => c.id)).not.toEqual(deck.map((c) => c.id));
  });

  it("produces secure random ints within range", () => {
    for (let i = 0; i < 500; i++) {
      const n = secureRandomInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
    expect(() => secureRandomInt(0)).toThrow();
  });

  it("deals round-robin and removes dealt cards from the deck", () => {
    const deck = createDeck();
    const { hands, deck: rest } = dealCards(deck, 4, 6);
    expect(hands.map((h) => h.length)).toEqual([6, 6, 6, 6]);
    expect(rest).toHaveLength(80);
    expect(hands[0]![0]).toEqual(deck[0]);
    expect(hands[1]![0]).toEqual(deck[1]);
    expect(() => dealCards(deck.slice(0, 5), 2, 7)).toThrow();
  });
});

describe("createGame", () => {
  it("deals 7 cards per player in 1v1", () => {
    const game = newGame("1v1");
    expect(game.players.map((p) => p.hand.length)).toEqual([7, 7]);
    expect(game.deck).toHaveLength(104 - 14);
    expect(game.config.sequencesToWin).toBe(2);
  });

  it("deals 6 cards per player in 2v2 with alternating team seats", () => {
    const game = newGame("2v2");
    expect(game.players.map((p) => p.hand.length)).toEqual([6, 6, 6, 6]);
    expect(game.players.map((p) => p.team)).toEqual([
      "red",
      "blue",
      "red",
      "blue",
    ]);
    expect(game.deck).toHaveLength(80);
  });

  it("rejects unbalanced teams and wrong player counts", () => {
    expect(() =>
      createGame({
        id: "x",
        mode: "1v1",
        players: [
          { userId: "a", nickname: "A", team: "red" },
          { userId: "b", nickname: "B", team: "red" },
        ],
      }),
    ).toThrow(/balanced/);
    expect(() =>
      createGame({
        id: "x",
        mode: "2v2",
        players: [{ userId: "a", nickname: "A", team: "red" }],
      }),
    ).toThrow(/requires/);
  });
});
