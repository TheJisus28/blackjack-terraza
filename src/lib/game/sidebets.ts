import { handTotal, isRed, rankOf, suitOf } from "./cards";
import type { CardCode } from "./types";

export const SIDE_BET_IDS = ["pp", "t21", "hot3", "bust"] as const;
export type SideBetId = (typeof SIDE_BET_IDS)[number];

export type PerfectPairKind = "perfect" | "colored" | "mixed";
export type ThreeCardKind = "suitedTrips" | "straightFlush" | "trips" | "straight" | "flush";
export type HotThreeKind = "sevens" | "suited21" | "21" | "20" | "19";
export type BustKind = "bust3" | "bust4" | "bust5" | "bust6" | "bust7" | "bust8";
export type SideKind = PerfectPairKind | ThreeCardKind | HotThreeKind | BustKind;

export interface SideOutcome {
  kind: SideKind;
  /** Pays `multiplier` to 1. */
  multiplier: number;
}

export const SIDE_BETS: Record<
  SideBetId,
  { name: string; short: string; top: string; when: "deal" | "dealer"; help: string; color: string }
> = {
  pp: { name: "Pares perfectos", short: "PP", top: "25:1", when: "deal", help: "Tus dos primeras cartas forman un par", color: "#ff6fb5" },
  t21: { name: "21+3", short: "21+3", top: "100:1", when: "deal", help: "Tus dos cartas + la del crupier forman jugada de póker", color: "#4cc3ff" },
  hot3: { name: "Hot 3", short: "HOT 3", top: "100:1", when: "deal", help: "Tus dos cartas + la del crupier suman 19, 20 o 21", color: "#ffb02e" },
  bust: { name: "Bust It", short: "BUST", top: "250:1", when: "dealer", help: "El crupier se pasa; paga más cuantas más cartas use", color: "#ff4d4d" },
};

export const PERFECT_PAIRS_PAYTABLE: Record<PerfectPairKind, number> = { perfect: 25, colored: 12, mixed: 6 };

export const THREE_CARD_PAYTABLE: Record<ThreeCardKind, number> = {
  suitedTrips: 100,
  straightFlush: 40,
  trips: 30,
  straight: 10,
  flush: 5,
};

export const HOT_THREE_PAYTABLE: Record<HotThreeKind, number> = { sevens: 100, suited21: 20, "21": 4, "20": 2, "19": 1 };

export const BUST_PAYTABLE: Record<BustKind, number> = { bust3: 1, bust4: 2, bust5: 9, bust6: 50, bust7: 100, bust8: 250 };

export const SIDE_KIND_LABELS: Record<SideKind, string> = {
  perfect: "Par perfecto",
  colored: "Par de color",
  mixed: "Par mixto",
  suitedTrips: "Trío del mismo palo",
  straightFlush: "Escalera de color",
  trips: "Trío",
  straight: "Escalera",
  flush: "Color",
  sevens: "7-7-7",
  suited21: "21 del mismo palo",
  "21": "21",
  "20": "20",
  "19": "19",
  bust3: "Se pasa con 3 cartas",
  bust4: "Se pasa con 4 cartas",
  bust5: "Se pasa con 5 cartas",
  bust6: "Se pasa con 6 cartas",
  bust7: "Se pasa con 7 cartas",
  bust8: "Se pasa con 8+ cartas",
};

/** Same rank required (a king and a queen are not a pair here). */
export function perfectPairs(a: CardCode, b: CardCode): SideOutcome | null {
  if (rankOf(a) !== rankOf(b)) return null;
  if (suitOf(a) === suitOf(b)) return { kind: "perfect", multiplier: PERFECT_PAIRS_PAYTABLE.perfect };
  if (isRed(a) === isRed(b)) return { kind: "colored", multiplier: PERFECT_PAIRS_PAYTABLE.colored };
  return { kind: "mixed", multiplier: PERFECT_PAIRS_PAYTABLE.mixed };
}

const RANK_ORDER = "A23456789TJQK";

function isStraight(cards: CardCode[]): boolean {
  const v = cards.map((c) => RANK_ORDER.indexOf(rankOf(c)) + 1).sort((x, y) => x - y);
  if (v[1] === v[0] + 1 && v[2] === v[1] + 1) return true;
  // Ace high: Q-K-A.
  return v[0] === 1 && v[1] === 12 && v[2] === 13;
}

/** Poker hand made of the player's first two cards and the dealer's up card. */
export function twentyOnePlusThree(a: CardCode, b: CardCode, up: CardCode): SideOutcome | null {
  const cards = [a, b, up];
  const flush = cards.every((c) => suitOf(c) === suitOf(a));
  const trips = cards.every((c) => rankOf(c) === rankOf(a));
  const straight = !trips && isStraight(cards);
  let kind: ThreeCardKind | null = null;
  if (trips && flush) kind = "suitedTrips";
  else if (straight && flush) kind = "straightFlush";
  else if (trips) kind = "trips";
  else if (straight) kind = "straight";
  else if (flush) kind = "flush";
  return kind ? { kind, multiplier: THREE_CARD_PAYTABLE[kind] } : null;
}

/** Best blackjack total of the player's two cards plus the dealer's up card. */
export function hotThree(a: CardCode, b: CardCode, up: CardCode): SideOutcome | null {
  const cards = [a, b, up];
  if (cards.every((c) => rankOf(c) === "7")) return { kind: "sevens", multiplier: HOT_THREE_PAYTABLE.sevens };
  const { total } = handTotal(cards);
  if (total === 21) {
    const suited = cards.every((c) => suitOf(c) === suitOf(a));
    return suited ? { kind: "suited21", multiplier: HOT_THREE_PAYTABLE.suited21 } : { kind: "21", multiplier: HOT_THREE_PAYTABLE["21"] };
  }
  if (total === 20) return { kind: "20", multiplier: HOT_THREE_PAYTABLE["20"] };
  if (total === 19) return { kind: "19", multiplier: HOT_THREE_PAYTABLE["19"] };
  return null;
}

/** Wins when the dealer's final hand busts; pays by the number of cards it took. */
export function bustIt(dealerCards: CardCode[]): SideOutcome | null {
  if (handTotal(dealerCards).total <= 21) return null;
  const n = Math.min(8, Math.max(3, dealerCards.length));
  const kind = `bust${n}` as BustKind;
  return { kind, multiplier: BUST_PAYTABLE[kind] };
}

/** Largest side bet allowed at a table. */
export const maxSideBet = (maxBet: number) => Math.max(1, Math.floor(maxBet / 5));
