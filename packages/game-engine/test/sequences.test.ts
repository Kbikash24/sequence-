import { describe, expect, it } from "vitest";
import type { Sequence } from "@sequence/shared";
import {
  checkWinner,
  detectSequences,
  initializeBoard,
  type Chips,
} from "../src";

function chipsFor(red: number[], blue: number[] = []): Chips {
  const chips = initializeBoard();
  for (const c of red) chips[c] = "red";
  for (const c of blue) chips[c] = "blue";
  return chips;
}

const range = (from: number, to: number, step = 1) => {
  const out: number[] = [];
  for (let i = from; step > 0 ? i <= to : i >= to; i += step) out.push(i);
  return out;
};

describe("detectSequences", () => {
  it("detects horizontal sequences", () => {
    const chips = chipsFor(range(11, 15));
    const found = detectSequences(chips, [], "red", 13);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      team: "red",
      direction: "H",
      cells: [11, 12, 13, 14, 15],
    });
  });

  it("detects vertical sequences", () => {
    const chips = chipsFor([13, 23, 33, 43, 53]);
    const found = detectSequences(chips, [], "red", 53);
    expect(found).toHaveLength(1);
    expect(found[0]!.direction).toBe("V");
  });

  it("detects both diagonal directions", () => {
    const d1 = detectSequences(chipsFor([11, 22, 33, 44, 55]), [], "red", 33);
    expect(d1).toHaveLength(1);
    expect(d1[0]!.direction).toBe("D1");
    const d2 = detectSequences(chipsFor([18, 27, 36, 45, 54]), [], "red", 18);
    expect(d2).toHaveLength(1);
    expect(d2[0]!.direction).toBe("D2");
  });

  it("counts free corners for any team", () => {
    const chips = chipsFor([1, 2, 3, 4], [10, 20, 30, 40]);
    const red = detectSequences(chips, [], "red", 4);
    const blue = detectSequences(chips, [], "blue", 40);
    expect(red[0]!.cells).toEqual([0, 1, 2, 3, 4]);
    expect(blue[0]!.cells).toEqual([0, 10, 20, 30, 40]);
  });

  it("does not count four chips or opponent chips", () => {
    expect(
      detectSequences(chipsFor(range(11, 14)), [], "red", 14),
    ).toHaveLength(0);
    expect(
      detectSequences(chipsFor([11, 12, 14, 15], [13]), [], "red", 15),
    ).toHaveLength(0);
  });

  it("creates two sequences from nine in a row sharing one chip", () => {
    const found = detectSequences(chipsFor(range(10, 18)), [], "red", 14);
    expect(found.map((s) => s.cells)).toEqual([
      [10, 11, 12, 13, 14],
      [14, 15, 16, 17, 18],
    ]);
  });

  it("does not create a second sequence that shares more than one chip", () => {
    const existing: Sequence[] = [
      { id: "s", team: "red", direction: "H", cells: range(10, 14) },
    ];
    expect(
      detectSequences(chipsFor(range(10, 15)), existing, "red", 15),
    ).toHaveLength(0);
    expect(
      detectSequences(chipsFor(range(10, 17)), existing, "red", 17),
    ).toHaveLength(0);
    const ok = detectSequences(chipsFor(range(10, 18)), existing, "red", 18);
    expect(ok.map((s) => s.cells)).toEqual([[14, 15, 16, 17, 18]]);
  });

  it("allows crossing sequences that share one chip", () => {
    const existing: Sequence[] = [
      { id: "s", team: "red", direction: "H", cells: range(11, 15) },
    ];
    const chips = chipsFor([...range(11, 15), 23, 33, 43, 53]);
    const found = detectSequences(chips, existing, "red", 53);
    expect(found).toHaveLength(1);
    expect(found[0]!.cells).toEqual([13, 23, 33, 43, 53]);
  });

  it("ignores the other team’s sequences for overlap", () => {
    const existing: Sequence[] = [
      { id: "s", team: "blue", direction: "H", cells: [0, 1, 2, 3, 4] },
    ];
    const chips = chipsFor([10, 20, 30, 40]);
    expect(detectSequences(chips, existing, "red", 40)).toHaveLength(1);
  });
});

describe("checkWinner", () => {
  const config = { sequencesToWin: 2, handSize: 7, maxTurns: 1000 };
  const seq = (team: "red" | "blue", n: number): Sequence => ({
    id: `${team}${n}`,
    team,
    direction: "H",
    cells: [n],
  });

  it("requires the configured number of sequences", () => {
    expect(checkWinner({ sequences: [seq("red", 1)], config })).toBeNull();
    expect(
      checkWinner({ sequences: [seq("red", 1), seq("blue", 2)], config }),
    ).toBeNull();
    expect(
      checkWinner({
        sequences: [seq("red", 1), seq("blue", 2), seq("blue", 3)],
        config,
      }),
    ).toBe("blue");
  });
});
