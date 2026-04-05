import type { Card, Rank, Suit } from "./types";

const SUITS: Suit[] = ["clubs", "diamonds", "hearts", "spades"];
const RANKS: Rank[] = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "jack", "queen", "king", "ace",
];

function createSingleDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, faceUp: true });
    }
  }
  return deck;
}

function shuffle<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createShoe(deckCount: number): Card[] {
  const shoe: Card[] = [];
  for (let i = 0; i < deckCount; i++) {
    shoe.push(...createSingleDeck());
  }
  return shuffle(shoe);
}

export function drawCard(
  deck: Card[],
  faceUp = true,
): { card: Card; deck: Card[] } {
  if (deck.length === 0) {
    throw new Error("Deck is empty");
  }
  const [card, ...rest] = deck;
  return { card: { ...card, faceUp }, deck: rest };
}

export function shouldReshuffle(deck: Card[], deckCount: number): boolean {
  const totalCards = deckCount * 52;
  return deck.length < totalCards * 0.25;
}

export function getCardImagePath(card: Card): string {
  if (!card.faceUp) return "/cards/back.png";
  return `/cards/${card.rank}_of_${card.suit}.svg`;
}
