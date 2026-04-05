import type { GameState } from "../model/types";
import { CARD_DEAL_DURATION_MS, CARD_SEQUENTIAL_STEP_MS } from "../rules/constants";

export type TableCardLayout = Pick<GameState, "players" | "dealer">;

/** Stable signature to memoize the index map from visible cards */
export function dealLayoutSignature(state: TableCardLayout): string {
  return JSON.stringify({
    p: state.players.map((p) =>
      p.hands.map((h) => h.cards.map((c) => [c.rank, c.suit, c.faceUp])),
    ),
    d: state.dealer.cards.map((c) => [c.rank, c.suit, c.faceUp]),
  });
}

export function playerCardKey(pi: number, hi: number, ci: number): string {
  return `p:${pi}:h:${hi}:c:${ci}`;
}

export function dealerCardKey(ci: number): string {
  return `d:${ci}`;
}

/**
 * Global visual deal order (one card at a time table-wide):
 * 1) Two rounds like the engine: each round, every player with a bet on hand 0 (seat order), then dealer.
 * 2) Remaining player cards (pi, hi, ci) not yet assigned.
 * 3) Remaining dealer cards (e.g. hits).
 */
export function assignGlobalDealIndices(state: TableCardLayout): Map<string, number> {
  const map = new Map<string, number>();
  let g = 0;
  const { players, dealer } = state;

  for (let round = 0; round < 2; round++) {
    for (let pi = 0; pi < players.length; pi++) {
      const p = players[pi];
      if (!p.hands[0] || p.hands[0].bet <= 0) continue;
      if (p.hands[0].cards.length <= round) continue;
      map.set(playerCardKey(pi, 0, round), g++);
    }
    if (dealer.cards.length > round) {
      map.set(dealerCardKey(round), g++);
    }
  }

  for (let pi = 0; pi < players.length; pi++) {
    const p = players[pi];
    for (let hi = 0; hi < p.hands.length; hi++) {
      for (let ci = 0; ci < p.hands[hi].cards.length; ci++) {
        const k = playerCardKey(pi, hi, ci);
        if (!map.has(k)) map.set(k, g++);
      }
    }
  }

  for (let ci = 0; ci < dealer.cards.length; ci++) {
    const k = dealerCardKey(ci);
    if (!map.has(k)) map.set(k, g++);
  }

  return map;
}

export function maxGlobalDealIndex(map: Map<string, number>): number {
  let max = -1;
  for (const v of map.values()) max = Math.max(max, v);
  return max;
}

export function totalCardsOnTable(layout: TableCardLayout): number {
  let n = layout.dealer.cards.length;
  for (const p of layout.players) {
    for (const h of p.hands) {
      n += h.cards.length;
    }
  }
  return n;
}

export function maxDealGlobalIndex(layout: TableCardLayout): number {
  return maxGlobalDealIndex(assignGlobalDealIndices(layout));
}

/**
 * Time until the **new batch** of card animations finishes vs the last settled `maxGlobal`
 * (same logic as DealAnimationProvider). Used for UI feedback / sounds when the dealer draws
 * many cards without scaling from a full-table `maxG * STEP` from zero.
 */
export function feedbackWaveDurationMs(
  layout: TableCardLayout,
  previousMaxGlobalIndex: number,
): number {
  const total = totalCardsOnTable(layout);
  if (total === 0) return 0;
  const maxG = maxDealGlobalIndex(layout);
  if (maxG < 0) return 0;
  if (maxG <= previousMaxGlobalIndex) return CARD_DEAL_DURATION_MS;
  return (
    (maxG - previousMaxGlobalIndex - 1) * CARD_SEQUENTIAL_STEP_MS +
    CARD_DEAL_DURATION_MS
  );
}

