/**
 * Player-issued moves (also appears inside the broader session / API action union).
 */
export const PLAYER_ACTION = {
  HIT: "hit",
  STAND: "stand",
  DOUBLE: "double",
  SPLIT: "split",
  SURRENDER: "surrender",
  BET: "bet",
} as const;

export type PlayerAction = (typeof PLAYER_ACTION)[keyof typeof PLAYER_ACTION];
