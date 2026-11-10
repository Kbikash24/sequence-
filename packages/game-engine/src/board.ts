import type { CardCode, Team } from "@sequence/shared";

export const BOARD_SIZE = 10;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
export const FREE_CELL = "FREE" as const;
export type BoardCard = CardCode | typeof FREE_CELL;
export type Chips = (Team | null)[];

// Classic Sequence-style layout: each non-jack card appears exactly twice, W = free corner.
const LAYOUT_ROWS = [
  "W  2S 3S 4S 5S 6S 7S 8S 9S W ",
  "6C 5C 4C 3C 2C AH KH QH TH TS",
  "7C AS 2D 3D 4D 5D 6D 7D 9H QS",
  "8C KS 6C 5C 4C 3C 2C 8D 8H KS",
  "9C QS 7C 6H 5H 4H AH 9D 7H AS",
  "TC TS 8C 7H 2H 3H KH TD 6H 2D",
  "QC 9S 9C 8H 9H TH QH QD 5H 3D",
  "KC 8S TC QC KC AC AD KD 4H 4D",
  "AC 7S 6S 5S 4S 3S 2S 2H 3H 5D",
  "W  AD KD QD TD 9D 8D 7D 6D W ",
];

export const BOARD_LAYOUT: readonly BoardCard[] = Object.freeze(
  LAYOUT_ROWS.flatMap((row) =>
    row
      .trim()
      .split(/\s+/)
      .map((token) => (token === "W" ? FREE_CELL : (token as CardCode))),
  ),
);

export const CORNER_CELLS: readonly number[] = [0, 9, 90, 99];

const positionsByCard = new Map<CardCode, number[]>();
BOARD_LAYOUT.forEach((card, index) => {
  if (card === FREE_CELL) return;
  const list = positionsByCard.get(card) ?? [];
  list.push(index);
  positionsByCard.set(card, list);
});

export function getCardPositions(code: CardCode): readonly number[] {
  return positionsByCard.get(code) ?? [];
}

export function isValidCell(cell: number): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell < CELL_COUNT;
}

export function isCorner(cell: number): boolean {
  return BOARD_LAYOUT[cell] === FREE_CELL;
}

export function toIndex(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

export function toRowCol(cell: number): { row: number; col: number } {
  return { row: Math.floor(cell / BOARD_SIZE), col: cell % BOARD_SIZE };
}

export function initializeBoard(): Chips {
  return Array.from({ length: CELL_COUNT }, () => null);
}

export function placeChip(chips: Chips, cell: number, team: Team): Chips {
  if (!isValidCell(cell) || isCorner(cell))
    throw new RangeError(`Cannot place on cell ${cell}`);
  if (chips[cell] !== null) throw new Error(`Cell ${cell} is occupied`);
  const next = [...chips];
  next[cell] = team;
  return next;
}

export function removeChip(chips: Chips, cell: number): Chips {
  if (!isValidCell(cell) || chips[cell] === null)
    throw new Error(`No chip on cell ${cell}`);
  const next = [...chips];
  next[cell] = null;
  return next;
}
