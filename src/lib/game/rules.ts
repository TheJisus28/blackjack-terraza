import { cardValue, handValue, rankOf } from "./cards";
import type { Seat, TableConfig } from "./types";

export interface AllowedActions {
  hit: boolean;
  stand: boolean;
  double: boolean;
  split: boolean;
  surrender: boolean;
}

export const NO_ACTIONS: AllowedActions = { hit: false, stand: false, double: false, split: false, surrender: false };

type RulesConfig = Pick<
  TableConfig,
  "hitSplitAces" | "doubleOn" | "doubleAfterSplit" | "maxHands" | "resplitAces" | "surrender"
>;

export function allowedActions(config: RulesConfig, seat: Seat, handIndex: number): AllowedActions {
  const hand = seat.hands[handIndex];
  if (!hand || hand.done) return NO_ACTIONS;

  const { total } = handValue(hand);
  const twoCards = hand.cards.length === 2;
  const hit = total < 21 && !(hand.splitAces && !config.hitSplitAces);

  const doubleTotalOk =
    config.doubleOn === "any" ||
    (config.doubleOn === "9-11" ? total >= 9 && total <= 11 : total >= 10 && total <= 11);
  const double =
    twoCards &&
    hit &&
    !hand.doubled &&
    seat.stack >= hand.bet &&
    doubleTotalOk &&
    (!hand.split || config.doubleAfterSplit);

  const pair = twoCards && cardValue(hand.cards[0].c) === cardValue(hand.cards[1].c);
  const aces = pair && rankOf(hand.cards[0].c) === "A";
  const split =
    pair &&
    seat.hands.length < config.maxHands &&
    seat.stack >= hand.bet &&
    (!aces || !hand.splitAces || config.resplitAces);

  const surrender = config.surrender && twoCards && seat.hands.length === 1 && !hand.split && !hand.doubled;

  return { hit, stand: true, double, split, surrender };
}

export function describeRules(config: TableConfig): string[] {
  const rules = [
    `${config.decks} ${config.decks === 1 ? "mazo" : "mazos"}`,
    config.hitSoft17 ? "Crupier pide 17 suave (H17)" : "Crupier se planta en 17 (S17)",
    config.blackjackPays >= 1.5 ? "Blackjack paga 3:2" : "Blackjack paga 6:5",
    config.doubleOn === "any" ? "Doblar con cualquier mano" : `Doblar solo con ${config.doubleOn}`,
    config.doubleAfterSplit ? "Doblar tras dividir" : "Sin doblar tras dividir",
    `Dividir hasta ${config.maxHands} manos`,
  ];
  if (config.surrender) rules.push("Rendición tardía");
  if (config.insurance) rules.push("Seguro paga 2:1");
  if (config.resplitAces) rules.push("Redividir ases");
  if (config.sideBets) rules.push("Laterales: Pares perfectos, 21+3, Hot 3 y Bust It");
  return rules;
}
