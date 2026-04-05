/**
 * Single source for simulation phase string literals (FSM states for rules).
 * Import `PHASE` instead of comparing raw strings so refactors stay safe.
 */
export const PHASE = {
  WAITING: "waiting",
  BETTING: "betting",
  INSURANCE: "insurance",
  PLAYING: "playing",
  DEALER_TURN: "dealer_turn",
  RESOLVING: "resolving",
  FINISHED: "finished",
} as const;

export type GamePhase = (typeof PHASE)[keyof typeof PHASE];
