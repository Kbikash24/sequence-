import type { CardCode, Rank, Suit } from "./types";

export const SUIT_SYMBOL: Record<Suit, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};
export const SUIT_NAME: Record<Suit, string> = {
  S: "spades",
  H: "hearts",
  D: "diamonds",
  C: "clubs",
};
const RANK_NAME: Record<Rank, string> = {
  A: "Ace",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  T: "10",
  J: "Jack",
  Q: "Queen",
  K: "King",
};

export function cardRank(code: CardCode): Rank {
  return code[0] as Rank;
}

export function cardSuit(code: CardCode): Suit {
  return code[1] as Suit;
}

export function rankLabel(code: CardCode): string {
  const rank = cardRank(code);
  return rank === "T" ? "10" : rank;
}

export function isRedSuit(code: CardCode): boolean {
  const suit = cardSuit(code);
  return suit === "H" || suit === "D";
}

/** Short label such as "10♥". */
export function cardLabel(code: CardCode): string {
  return `${rankLabel(code)}${SUIT_SYMBOL[cardSuit(code)]}`;
}

/** Accessible label such as "Queen of spades". */
export function cardName(code: CardCode): string {
  return `${RANK_NAME[cardRank(code)]} of ${SUIT_NAME[cardSuit(code)]}`;
}

export function isJack(code: CardCode): boolean {
  return cardRank(code) === "J";
}

/** Two-eyed jacks (diamonds, clubs) are wild: place anywhere empty. */
export function isTwoEyedJack(code: CardCode): boolean {
  return code === "JD" || code === "JC";
}

/** One-eyed jacks (spades, hearts) remove an opponent chip. */
export function isOneEyedJack(code: CardCode): boolean {
  return code === "JS" || code === "JH";
}

/** Board coordinate label such as "C7" (row letter, column number). */
export function cellLabel(cell: number): string {
  const row = Math.floor(cell / 10);
  const col = cell % 10;
  return `${"ABCDEFGHIJ"[row]}${col + 1}`;
}
