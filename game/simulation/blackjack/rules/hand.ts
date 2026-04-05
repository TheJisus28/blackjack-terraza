import type { Card, Hand, HandStatus, Rank } from "../model/types";

const CARD_VALUES: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
  jack: 10, queen: 10, king: 10, ace: 11,
};

export function getHandValue(cards: Card[]): number {
  let value = 0;
  let aces = 0;

  for (const card of cards) {
    if (!card.faceUp) continue;
    value += CARD_VALUES[card.rank];
    if (card.rank === "ace") aces++;
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return value;
}

export function isSoft(cards: Card[]): boolean {
  let value = 0;
  let aces = 0;

  for (const card of cards) {
    if (!card.faceUp) continue;
    value += CARD_VALUES[card.rank];
    if (card.rank === "ace") aces++;
  }

  while (value > 21 && aces > 1) {
    value -= 10;
    aces--;
  }

  return aces > 0 && value <= 21;
}

export function isTenValueRank(rank: Rank): boolean {
  return (
    rank === "10" || rank === "jack" || rank === "queen" || rank === "king"
  );
}

/**
 * Natural blackjack from two cards (dealer hole-card peek).
 * Uses ranks only so a face-down ace under a 10-up is still detected without revealing the hole to the UI.
 */
export function isNaturalBlackjackCards(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const ranks = cards.map((c) => c.rank);
  const hasAce = ranks.includes("ace");
  const hasTen = ranks.some((r) => isTenValueRank(r));
  return hasAce && hasTen;
}

export function isBlackjack(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const visibleCards = cards.filter((c) => c.faceUp);
  if (visibleCards.length !== 2) return false;
  return getHandValue(visibleCards) === 21;
}

export function isBusted(cards: Card[]): boolean {
  return getHandValue(cards) > 21;
}

export function canSplit(hand: Hand): boolean {
  if (hand.cards.length !== 2) return false;
  if (hand.isSplit) return false;
  const [a, b] = hand.cards;
  return CARD_VALUES[a.rank] === CARD_VALUES[b.rank];
}

export function canDoubleDown(hand: Hand): boolean {
  return hand.cards.length === 2 && !hand.isDoubledDown;
}

export function canSurrender(hand: Hand): boolean {
  return hand.cards.length === 2 && !hand.isSplit && !hand.isDoubledDown;
}

export function getHandStatus(cards: Card[]): HandStatus {
  if (isBlackjack(cards)) return "blackjack";
  if (isBusted(cards)) return "busted";
  return "playing";
}

export function createHand(bet: number): Hand {
  return {
    cards: [],
    bet,
    status: "playing",
    isDoubledDown: false,
    isSplit: false,
  };
}
