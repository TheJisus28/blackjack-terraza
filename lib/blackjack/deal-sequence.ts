import type { GameState } from "./types";
import { CARD_DEAL_DURATION_MS, CARD_SEQUENTIAL_STEP_MS } from "./constants";

export type TableCardLayout = Pick<GameState, "players" | "dealer">;

/** Firma estable para memoizar el mapa de índices según cartas visibles */
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
 * Orden visual de reparto (una carta tras otra en toda la mesa):
 * 1) Dos rondas como el motor: por ronda, cada jugador con apuesta en mano 0 (en orden), luego crupier.
 * 2) Resto de cartas de jugadores (pi, hi, ci) no asignadas aún.
 * 3) Cartas del crupier no asignadas (p. ej. robos).
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

/** Tiempo hasta que la última carta de la mesa termina su animación de reparto */
export function maxDealAnimationDurationMs(state: TableCardLayout): number {
  const map = assignGlobalDealIndices(state);
  const maxG = maxGlobalDealIndex(map);
  if (maxG < 0) return 0;
  return maxG * CARD_SEQUENTIAL_STEP_MS + CARD_DEAL_DURATION_MS;
}
