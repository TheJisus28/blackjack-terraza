import { cardValue, handTotal, rankOf } from "./cards";
import type { AllowedActions } from "./rules";
import type { CardCode } from "./types";

export type Move = "hit" | "stand" | "double" | "split" | "surrender";

export const MOVE_LABELS: Record<Move, string> = {
  hit: "Pedir",
  stand: "Plantarse",
  double: "Doblar",
  split: "Dividir",
  surrender: "Rendirse",
};

interface StrategyRules {
  hitSoft17: boolean;
  doubleAfterSplit: boolean;
}

/** Multi-deck basic strategy, adjusted for H17/S17 and DAS. */
export function basicStrategy(
  cards: readonly CardCode[],
  dealerUp: CardCode,
  allowed: AllowedActions,
  rules: StrategyRules,
): Move {
  const d = cardValue(dealerUp);
  const { total, soft } = handTotal(cards);
  const h17 = rules.hitSoft17;
  const das = rules.doubleAfterSplit;
  const between = (lo: number, hi: number) => d >= lo && d <= hi;
  const doubleOr = (fallback: Move): Move => (allowed.double ? "double" : fallback);

  const pair = cards.length === 2 && cardValue(cards[0]) === cardValue(cards[1]);
  const pairRank = pair ? rankOf(cards[0]) : null;

  // Surrender comes first: it is only offered as the very first decision.
  if (allowed.surrender) {
    if (!soft && !pair && total === 16 && d >= 9) return "surrender";
    if (!soft && !pair && total === 15 && (d === 10 || (h17 && d === 11))) return "surrender";
    if (pairRank && cardValue(cards[0]) === 8 && h17 && d === 11) return "surrender";
    if (!soft && total === 17 && h17 && d === 11) return "surrender";
  }

  if (pair && allowed.split && pairRank) {
    const v = cardValue(cards[0]);
    if (pairRank === "A") return "split";
    if (v === 9 && (between(2, 6) || d === 8 || d === 9)) return "split";
    if (v === 8) return "split";
    if (v === 7 && between(2, 7)) return "split";
    if (v === 6 && (das ? between(2, 6) : between(3, 6))) return "split";
    if (v === 4 && das && between(5, 6)) return "split";
    if ((v === 2 || v === 3) && (das ? between(2, 7) : between(4, 7))) return "split";
  }

  if (soft && total <= 21) {
    if (total >= 20) return "stand";
    if (total === 19) return h17 && d === 6 ? doubleOr("stand") : "stand";
    if (total === 18) {
      if (h17 ? between(2, 6) : between(3, 6)) return doubleOr("stand");
      if (d === 2 || d === 7 || d === 8) return "stand";
      return "hit";
    }
    if (total === 17) return between(3, 6) ? doubleOr("hit") : "hit";
    if (total === 15 || total === 16) return between(4, 6) ? doubleOr("hit") : "hit";
    return between(5, 6) ? doubleOr("hit") : "hit";
  }

  if (total >= 17) return "stand";
  if (total >= 13) return between(2, 6) ? "stand" : "hit";
  if (total === 12) return between(4, 6) ? "stand" : "hit";
  if (total === 11) return h17 || d <= 10 ? doubleOr("hit") : "hit";
  if (total === 10) return between(2, 9) ? doubleOr("hit") : "hit";
  if (total === 9) return between(3, 6) ? doubleOr("hit") : "hit";
  return "hit";
}

/** Strategy move restricted to what the table currently allows. */
export function safeMove(move: Move, allowed: AllowedActions): Move {
  if (allowed[move]) return move;
  if (move === "double" || move === "split") return allowed.hit ? "hit" : "stand";
  if (move === "surrender") return allowed.hit ? "hit" : "stand";
  return allowed.stand ? "stand" : move;
}
