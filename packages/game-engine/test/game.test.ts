import { describe, expect, it } from "vitest";
import {
  applyAction,
  drawCard,
  forfeitTeam,
  getCardTargets,
  getPlayerHand,
  isDeadCard,
  nextTurn,
  resetGame,
  skipTurn,
  toPublicState,
  validateMove,
  type GameState,
} from "../src";
import { newGame, seededRng, testCardId, withChips, withHand } from "./helpers";

const opts = { rng: seededRng(1), now: 5000 };

function expectFail(result: ReturnType<typeof applyAction>, code: string) {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.code).toBe(code);
}

function ok(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) throw new Error(`Expected ok, got ${result.code}`);
  return result.state;
}

describe("normal cards", () => {
  // AH sits at cells 15 and 46.
  const base = withHand(newGame(), 0, ["AH", "2S"]);

  it("lists unoccupied matching cells as targets", () => {
    expect(getCardTargets(base.chips, [], "AH", "red")).toEqual([15, 46]);
    const occupied = withChips(base, "blue", [15]);
    expect(getCardTargets(occupied.chips, [], "AH", "red")).toEqual([46]);
  });

  it("places a chip, refills the hand, advances the turn and version", () => {
    const state = ok(
      applyAction(
        base,
        "r1",
        { type: "place", cardId: testCardId("AH"), cell: 15 },
        opts,
      ),
    );
    expect(state.chips[15]).toBe("red");
    expect(state.players[0]!.hand).toHaveLength(2);
    expect(state.players[0]!.hand.some((c) => c.id === testCardId("AH"))).toBe(
      false,
    );
    expect(state.discard.at(-1)!.code).toBe("AH");
    expect(state.deck).toHaveLength(base.deck.length - 1);
    expect(state.currentSeat).toBe(1);
    expect(state.version).toBe(base.version + 1);
    expect(state.totalMoves).toBe(1);
    expect(state.lastAction).toMatchObject({
      type: "place",
      card: "AH",
      cell: 15,
    });
    // input state is untouched
    expect(base.chips[15]).toBeNull();
  });

  it("rejects invalid normal moves", () => {
    expectFail(
      applyAction(base, "r1", {
        type: "place",
        cardId: testCardId("AH"),
        cell: 16,
      }),
      "CARD_MISMATCH",
    );
    expectFail(
      applyAction(withChips(base, "blue", [15]), "r1", {
        type: "place",
        cardId: testCardId("AH"),
        cell: 15,
      }),
      "CELL_OCCUPIED",
    );
    expectFail(
      applyAction(base, "b1", {
        type: "place",
        cardId: testCardId("AH"),
        cell: 15,
      }),
      "NOT_YOUR_TURN",
    );
    expectFail(
      applyAction(base, "zz", {
        type: "place",
        cardId: testCardId("AH"),
        cell: 15,
      }),
      "NOT_IN_GAME",
    );
    expectFail(
      applyAction(base, "r1", { type: "place", cardId: "KH-0", cell: 16 }),
      "CARD_NOT_IN_HAND",
    );
    expectFail(
      applyAction(base, "r1", {
        type: "place",
        cardId: testCardId("2S", 1),
        cell: 0,
      }),
      "INVALID_CELL",
    );
    expectFail(
      applyAction(base, "r1", {
        type: "place",
        cardId: testCardId("2S", 1),
        cell: 120,
      }),
      "INVALID_CELL",
    );
  });

  it("rejects moves after the game is over", () => {
    const over = forfeitTeam(base, "blue", "forfeit");
    expectFail(
      applyAction(over, "r1", {
        type: "place",
        cardId: testCardId("AH"),
        cell: 15,
      }),
      "GAME_OVER",
    );
  });
});

describe("jacks", () => {
  it("two-eyed jacks place on any empty non-corner cell", () => {
    const base = withChips(withHand(newGame(), 0, ["JD"]), "blue", [55]);
    expect(getCardTargets(base.chips, [], "JD", "red")).toHaveLength(95);
    const state = ok(
      applyAction(
        base,
        "r1",
        { type: "place", cardId: testCardId("JD"), cell: 44 },
        opts,
      ),
    );
    expect(state.chips[44]).toBe("red");
    expectFail(
      applyAction(base, "r1", {
        type: "place",
        cardId: testCardId("JD"),
        cell: 0,
      }),
      "INVALID_CELL",
    );
    expectFail(
      applyAction(base, "r1", {
        type: "place",
        cardId: testCardId("JD"),
        cell: 55,
      }),
      "CELL_OCCUPIED",
    );
    expectFail(
      applyAction(base, "r1", {
        type: "remove",
        cardId: testCardId("JD"),
        cell: 55,
      }),
      "WRONG_CARD_TYPE",
    );
  });

  it("one-eyed jacks remove an opponent chip", () => {
    let base = withHand(newGame(), 0, ["JS", "AH"]);
    base = withChips(withChips(base, "blue", [55]), "red", [44]);
    expect(getCardTargets(base.chips, [], "JS", "red")).toEqual([55]);
    const state = ok(
      applyAction(
        base,
        "r1",
        { type: "remove", cardId: testCardId("JS"), cell: 55 },
        opts,
      ),
    );
    expect(state.chips[55]).toBeNull();
    expect(state.currentSeat).toBe(1);
    expectFail(
      applyAction(base, "r1", {
        type: "remove",
        cardId: testCardId("JS"),
        cell: 44,
      }),
      "OWN_CHIP",
    );
    expectFail(
      applyAction(base, "r1", {
        type: "remove",
        cardId: testCardId("JS"),
        cell: 66,
      }),
      "NO_CHIP",
    );
    expectFail(
      applyAction(base, "r1", {
        type: "place",
        cardId: testCardId("JS"),
        cell: 66,
      }),
      "WRONG_CARD_TYPE",
    );
    expectFail(
      applyAction(base, "r1", {
        type: "remove",
        cardId: testCardId("AH", 1),
        cell: 55,
      }),
      "WRONG_CARD_TYPE",
    );
  });

  it("one-eyed jacks cannot remove chips in a completed sequence", () => {
    let base = withHand(newGame(), 0, ["JH"]);
    base = withChips(base, "blue", [11, 12, 13, 14, 15]);
    base.sequences = [
      { id: "b", team: "blue", direction: "H", cells: [11, 12, 13, 14, 15] },
    ];
    expect(getCardTargets(base.chips, base.sequences, "JH", "red")).toEqual([]);
    expectFail(
      applyAction(base, "r1", {
        type: "remove",
        cardId: testCardId("JH"),
        cell: 13,
      }),
      "LOCKED_CHIP",
    );
  });
});

describe("dead cards", () => {
  const base = withChips(
    withHand(newGame(), 0, ["AH", "2S"]),
    "blue",
    [15, 46],
  );

  it("detects dead cards; jacks are never dead", () => {
    expect(isDeadCard(base.chips, "AH")).toBe(true);
    expect(isDeadCard(base.chips, "2S")).toBe(false);
    expect(isDeadCard(base.chips, "JD")).toBe(false);
  });

  it("exchanges a dead card once per turn without ending the turn", () => {
    const state = ok(
      applyAction(
        base,
        "r1",
        { type: "exchangeDead", cardId: testCardId("AH") },
        opts,
      ),
    );
    expect(state.players[0]!.hand).toHaveLength(2);
    expect(state.players[0]!.hand.some((c) => c.id === testCardId("AH"))).toBe(
      false,
    );
    expect(state.discard.at(-1)!.code).toBe("AH");
    expect(state.currentSeat).toBe(0);
    expect(state.deadCardExchanged).toBe(true);
    expect(state.version).toBe(base.version + 1);

    const again = withChips(withHand(state, 0, ["AH", "2S"]), "blue", []);
    expectFail(
      applyAction(again, "r1", {
        type: "exchangeDead",
        cardId: testCardId("AH"),
      }),
      "ALREADY_EXCHANGED",
    );
  });

  it("rejects exchanging a live card", () => {
    expectFail(
      applyAction(base, "r1", {
        type: "exchangeDead",
        cardId: testCardId("2S", 1),
      }),
      "NOT_DEAD",
    );
  });

  it("resets the exchange flag on the next turn", () => {
    const state = ok(
      applyAction(
        base,
        "r1",
        { type: "exchangeDead", cardId: testCardId("AH") },
        opts,
      ),
    );
    expect(nextTurn(state).deadCardExchanged).toBe(false);
  });
});

describe("winning", () => {
  it("ends the game when a team completes its second sequence", () => {
    // red has row 1 (10-14) and four chips of column 0 at rows 5..8; 6C at cell 10 is shared.
    let base = withHand(newGame(), 0, ["QC"]);
    base = withChips(base, "red", [10, 11, 12, 13, 14, 50, 70, 80]);
    base.sequences = [
      { id: "r", team: "red", direction: "H", cells: [10, 11, 12, 13, 14] },
    ];
    // cell 60 is QC; column 0: 50(TC), 60(QC), 70(KC), 80(AC), 90(corner)
    const state = ok(
      applyAction(
        base,
        "r1",
        { type: "place", cardId: testCardId("QC"), cell: 60 },
        opts,
      ),
    );
    expect(state.status).toBe("finished");
    expect(state.winner).toBe("red");
    expect(state.finishReason).toBe("sequences");
    expect(state.sequences).toHaveLength(2);
    expect(state.endedAt).toBe(5000);
    expect(state.currentSeat).toBe(0);
  });

  it("does not declare a winner with only one sequence", () => {
    let base = withHand(newGame(), 0, ["QC"]);
    base = withChips(base, "red", [50, 70, 80]);
    base.chips[40] = "red";
    const state = ok(
      applyAction(
        base,
        "r1",
        { type: "place", cardId: testCardId("QC"), cell: 60 },
        opts,
      ),
    );
    expect(state.sequences).toHaveLength(1);
    expect(state.status).toBe("playing");
  });
});

describe("turn management", () => {
  it("draws from a reshuffled discard pile when the deck is empty", () => {
    const base = newGame();
    base.discard = base.deck.splice(0, 3);
    base.discard.push(...base.deck.splice(0));
    const discardCount = base.discard.length;
    const state = drawCard(base, 0, seededRng(3));
    expect(state.players[0]!.hand).toHaveLength(8);
    expect(state.deck).toHaveLength(discardCount - 1);
    expect(state.discard).toHaveLength(0);
  });

  it("wraps turns around all seats in 2v2", () => {
    let state = newGame("2v2");
    const seats: number[] = [];
    for (let i = 0; i < 5; i++) {
      seats.push(state.currentSeat);
      state = nextTurn(state);
    }
    expect(seats).toEqual([0, 1, 2, 3, 0]);
  });

  it("skips a timed-out turn", () => {
    const base = newGame();
    const state = skipTurn(base, 9000);
    expect(state.currentSeat).toBe(1);
    expect(state.version).toBe(1);
    expect(state.lastAction).toMatchObject({ type: "timeout", seat: 0 });
    expect(state.players[0]!.hand).toEqual(base.players[0]!.hand);
  });

  it("ends in a draw after the max turn count", () => {
    const base = newGame();
    base.config.maxTurns = 1;
    const state = nextTurn(base);
    expect(state.status).toBe("finished");
    expect(state.finishReason).toBe("stalemate");
    expect(state.winner).toBeNull();
  });

  it("forfeits a team", () => {
    const state = forfeitTeam(newGame(), "red", "disconnect", 7000);
    expect(state.winner).toBe("blue");
    expect(state.finishReason).toBe("disconnect");
    expect(state.status).toBe("finished");
  });

  it("resets for a rematch with the same seats and rotated start", () => {
    const first = newGame("2v2");
    const next = resetGame(first, { id: "game-2", rng: seededRng(9) });
    expect(next.id).toBe("game-2");
    expect(next.players.map((p) => p.userId)).toEqual(
      first.players.map((p) => p.userId),
    );
    expect(next.currentSeat).toBe(1);
    expect(next.chips.every((c) => c === null)).toBe(true);
    expect(next.version).toBe(0);
  });
});

describe("views", () => {
  it("never exposes hands or deck order in public state", () => {
    const game = newGame();
    const pub = toPublicState(game, { turnDeadline: 123 });
    const json = JSON.stringify(pub);
    expect(json).not.toContain('"hand"');
    expect(json).not.toContain('"deck"');
    for (const p of game.players)
      for (const c of p.hand) expect(json).not.toContain(c.id);
    for (const c of game.deck) expect(json).not.toContain(c.id);
    expect(pub.players[0]!.handCount).toBe(7);
    expect(pub.deckCount).toBe(game.deck.length);
  });

  it("returns only the requesting player’s hand", () => {
    const game = newGame();
    expect(getPlayerHand(game, "r1")).toEqual(game.players[0]!.hand);
    expect(getPlayerHand(game, "nobody")).toEqual([]);
  });
});

describe("full game simulation", () => {
  it("plays random legal games to completion while conserving cards", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      let state = newGame(seed % 2 ? "1v1" : "2v2", seed);
      const rng = seededRng(seed * 31);
      let guard = 0;
      while (state.status === "playing" && guard++ < 5000) {
        const player = state.players[state.currentSeat]!;
        const options = player.hand.flatMap((card) =>
          getCardTargets(
            state.chips,
            state.sequences,
            card.code,
            player.team,
          ).map((cell) => ({ card, cell })),
        );
        if (options.length > 0) {
          const pick = options[rng(options.length)]!;
          const type =
            pick.card.code === "JS" || pick.card.code === "JH"
              ? "remove"
              : "place";
          const action = {
            type,
            cardId: pick.card.id,
            cell: pick.cell,
          } as const;
          expect(validateMove(state, player.userId, action).ok).toBe(true);
          state = ok(applyAction(state, player.userId, action, { rng }));
        } else {
          state = skipTurn(state);
        }
        const total =
          state.deck.length +
          state.discard.length +
          state.players.reduce((n, p) => n + p.hand.length, 0);
        expect(total).toBe(104);
      }
      expect(state.status).toBe("finished");
      if (state.finishReason === "sequences") {
        expect(
          state.sequences.filter((s) => s.team === state.winner).length,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
