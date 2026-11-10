import type { Sequence, SequenceDirection, Team } from "@sequence/shared";
import { BOARD_SIZE, isCorner, toIndex, toRowCol, type Chips } from "./board";

const SEQUENCE_LENGTH = 5;
const MAX_SHARED_CELLS = 1;

const DIRECTIONS: { direction: SequenceDirection; dr: number; dc: number }[] = [
  { direction: "H", dr: 0, dc: 1 },
  { direction: "V", dr: 1, dc: 0 },
  { direction: "D1", dr: 1, dc: 1 },
  { direction: "D2", dr: 1, dc: -1 },
];

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function ownsCell(chips: Chips, cell: number, team: Team): boolean {
  return chips[cell] === team || isCorner(cell);
}

function sharedCount(a: readonly number[], b: readonly number[]): number {
  const set = new Set(a);
  return b.reduce((n, cell) => (set.has(cell) ? n + 1 : n), 0);
}

export function sequenceId(team: Team, cells: readonly number[]): string {
  return `${team}:${[...cells].sort((x, y) => x - y).join(".")}`;
}

/**
 * Finds sequences newly completed by `team` through `cell`.
 * A new sequence may share at most one cell with any existing sequence of the same team.
 */
export function detectSequences(
  chips: Chips,
  existing: readonly Sequence[],
  team: Team,
  cell: number,
): Sequence[] {
  if (!ownsCell(chips, cell, team)) return [];
  const accepted: Sequence[] = [];
  const teamSequences = () => [
    ...existing.filter((s) => s.team === team),
    ...accepted,
  ];
  const origin = toRowCol(cell);

  for (const { direction, dr, dc } of DIRECTIONS) {
    let row = origin.row;
    let col = origin.col;
    while (
      inBounds(row - dr, col - dc) &&
      ownsCell(chips, toIndex(row - dr, col - dc), team)
    ) {
      row -= dr;
      col -= dc;
    }
    const line: number[] = [];
    while (inBounds(row, col) && ownsCell(chips, toIndex(row, col), team)) {
      line.push(toIndex(row, col));
      row += dr;
      col += dc;
    }
    if (line.length < SEQUENCE_LENGTH) continue;

    const pos = line.indexOf(cell);
    const firstStart = Math.max(0, pos - (SEQUENCE_LENGTH - 1));
    const lastStart = Math.min(pos, line.length - SEQUENCE_LENGTH);
    for (let start = firstStart; start <= lastStart; start++) {
      const window = line.slice(start, start + SEQUENCE_LENGTH);
      const conflicts = teamSequences().some(
        (s) => sharedCount(s.cells, window) > MAX_SHARED_CELLS,
      );
      if (conflicts) continue;
      accepted.push({
        id: sequenceId(team, window),
        team,
        cells: window,
        direction,
      });
    }
  }
  return accepted;
}

export function countSequences(
  sequences: readonly Sequence[],
): Record<Team, number> {
  const counts: Record<Team, number> = { red: 0, blue: 0 };
  for (const s of sequences) counts[s.team]++;
  return counts;
}

export function getLockedCells(sequences: readonly Sequence[]): Set<number> {
  const locked = new Set<number>();
  for (const s of sequences) for (const c of s.cells) locked.add(c);
  return locked;
}
