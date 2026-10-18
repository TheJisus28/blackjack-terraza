import { HIDDEN_CARD, type CardCode, type DealtCard, type Hand, type Rank, type Suit } from "./types";

export const SUITS: readonly Suit[] = ["S", "H", "D", "C"];
export const RANKS: readonly Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"];

export const rankOf = (card: CardCode) => card[0] as Rank;
export const suitOf = (card: CardCode) => card[1] as Suit;
export const isHidden = (card: CardCode) => card === HIDDEN_CARD;
export const isRed = (card: CardCode) => card[1] === "H" || card[1] === "D";

/** Blackjack value of a single card with aces counted as 11. */
export function cardValue(card: CardCode): number {
  const r = card[0];
  if (r === "A") return 11;
  if (r === "T" || r === "J" || r === "Q" || r === "K") return 10;
  return Number(r);
}

export function buildShoe(decks: number, rng: () => number): string {
  const cards: string[] = [];
  for (let d = 0; d < decks; d++) {
    for (const s of SUITS) for (const r of RANKS) cards.push(r + s);
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = cards[i];
    cards[i] = cards[j];
    cards[j] = tmp;
  }
  return cards.join("");
}

export interface HandTotal {
  total: number;
  /** At least one ace is still counted as 11. */
  soft: boolean;
}

export function handTotal(cards: readonly CardCode[]): HandTotal {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c === HIDDEN_CARD) continue;
    const v = cardValue(c);
    if (v === 11) aces++;
    total += v;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export const codes = (cards: readonly DealtCard[]) => cards.map((c) => c.c);

export function handValue(hand: Pick<Hand, "cards">): HandTotal {
  return handTotal(codes(hand.cards));
}

export function isNatural(hand: Pick<Hand, "cards" | "split">): boolean {
  return !hand.split && hand.cards.length === 2 && handValue(hand).total === 21;
}

export function isBust(hand: Pick<Hand, "cards">): boolean {
  return handValue(hand).total > 21;
}

export function dealerShouldHit(cards: readonly CardCode[], hitSoft17: boolean): boolean {
  const { total, soft } = handTotal(cards);
  return total < 17 || (total === 17 && soft && hitSoft17);
}

const RANK_NAMES: Record<Rank, string> = {
  A: "As",
  "2": "Dos",
  "3": "Tres",
  "4": "Cuatro",
  "5": "Cinco",
  "6": "Seis",
  "7": "Siete",
  "8": "Ocho",
  "9": "Nueve",
  T: "Diez",
  J: "Jota",
  Q: "Reina",
  K: "Rey",
};

export const rankName = (card: CardCode) => RANK_NAMES[rankOf(card)];

/** "17", "7/17" for soft totals, "BJ" for a natural. */
export function totalLabel(hand: Pick<Hand, "cards" | "split">): string {
  const visible = hand.cards.filter((c) => c.c !== HIDDEN_CARD);
  if (visible.length === 0) return "";
  if (isNatural(hand)) return "BJ";
  const { total, soft } = handTotal(codes(visible));
  if (soft && total < 21) return `${total - 10}/${total}`;
  return String(total);
}
