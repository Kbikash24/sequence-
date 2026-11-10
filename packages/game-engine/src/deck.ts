import { RANKS, SUITS, type Card, type CardCode } from "@sequence/shared";

/** Returns an integer in [0, maxExclusive). */
export type RandomInt = (maxExclusive: number) => number;

/** Cryptographically secure, unbiased random integer (rejection sampling). */
export const secureRandomInt: RandomInt = (maxExclusive) => {
  if (
    !Number.isInteger(maxExclusive) ||
    maxExclusive <= 0 ||
    maxExclusive > 0x100000000
  ) {
    throw new RangeError(`Invalid range: ${maxExclusive}`);
  }
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    globalThis.crypto.getRandomValues(buffer);
    value = buffer[0]!;
  } while (value >= limit);
  return value % maxExclusive;
};

/** Two standard 52-card decks without jokers (104 cards). */
export function createDeck(decks = 2): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const code = `${rank}${suit}` as CardCode;
        cards.push({ id: `${code}-${d}`, code });
      }
    }
  }
  return cards;
}

/** Fisher–Yates shuffle. Returns a new array. */
export function shuffleDeck<T>(
  deck: readonly T[],
  rng: RandomInt = secureRandomInt,
): T[] {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** Deals round-robin from the top of the deck (index 0). */
export function dealCards(
  deck: readonly Card[],
  playerCount: number,
  handSize: number,
): { hands: Card[][]; deck: Card[] } {
  const needed = playerCount * handSize;
  if (deck.length < needed) throw new Error("Not enough cards to deal");
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  for (let i = 0; i < needed; i++) {
    hands[i % playerCount]!.push(deck[i]!);
  }
  return { hands, deck: deck.slice(needed) };
}
