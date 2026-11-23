import { describe, expect, it } from "vitest";
import { buildHeadToHead, type SharedGameRow } from "../src/services/headToHead";

const row = (over: Partial<SharedGameRow>): SharedGameRow => ({
  gameId: "g",
  mode: "1v1",
  endedAt: 1,
  reason: "sequences",
  winnerTeam: "red",
  viewerTeam: "red",
  otherTeam: "blue",
  ...over,
});

describe("buildHeadToHead", () => {
  it("tallies opponent and teammate games from the viewer's perspective", () => {
    const h2h = buildHeadToHead({ userId: "u", nickname: "Ann" }, [
      row({ gameId: "a", endedAt: 1 }), // viewer beat them
      row({ gameId: "b", endedAt: 3, winnerTeam: "blue" }), // viewer lost
      row({ gameId: "c", endedAt: 2, winnerTeam: null }), // draw
      row({ gameId: "d", endedAt: 4, mode: "2v2", otherTeam: "red" }), // teammates, won
    ]);
    expect(h2h.summary.versus).toEqual({ matches: 3, wins: 1, losses: 1, draws: 1 });
    expect(h2h.summary.together).toEqual({ matches: 1, wins: 1, losses: 0, draws: 0 });
    expect(h2h.recent.map((m) => m.gameId)).toEqual(["d", "b", "c", "a"]);
    expect(h2h.recent[0]).toMatchObject({ relation: "teammate", outcome: "win" });
  });

  it("limits recent matches", () => {
    const games = Array.from({ length: 15 }, (_, i) => row({ gameId: `g${i}`, endedAt: i }));
    expect(buildHeadToHead({ userId: "u", nickname: "Ann" }, games).recent).toHaveLength(10);
  });
});
