/** All durations are in milliseconds. Server deadlines and client animations share them. */
export const TIMING = {
  betting: 15_000,
  shuffle: 3_200,
  dealCard: 420,
  dealExtra: 700,
  insurance: 9_000,
  turn: 20_000,
  turnAway: 3_000,
  turnAfk: 6_000,
  botThink: 1_100,
  botThinkJitter: 700,
  dealerReveal: 950,
  dealerDraw: 850,
  dealerExtra: 650,
  payout: 5_800,
  /** A disconnected player keeps the seat this long before being cashed out. */
  offlineGrace: 30_000,
  /** Grace for a freshly seated player whose presence has not been written yet. */
  joinGrace: 15_000,
} as const;

export const MAX_SEATS = 7;
export const MAX_IDLE_ROUNDS = 6;
export const AFK_TIMEOUTS = 2;

export const CHIP_DENOMINATIONS = [1, 5, 25, 100, 500, 1_000, 5_000, 25_000, 100_000] as const;

export const STARTING_CHIPS = 5_000;
export const DAILY_BONUS_BASE = 1_000;
export const DAILY_BONUS_STEP = 250;
export const DAILY_MAX_STREAK = 7;
export const DAILY_COOLDOWN = 20 * 60 * 60 * 1000;
export const RESCUE_CHIPS = 1_000;
export const RESCUE_THRESHOLD = 100;
export const RESCUE_COOLDOWN = 4 * 60 * 60 * 1000;

export const XP = {
  hand: 10,
  win: 6,
  blackjack: 25,
} as const;

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

export function xpForLevel(level: number): number {
  return (level - 1) * (level - 1) * 100;
}

export const BOT_NAMES = [
  "Valentina",
  "Andrés",
  "Camila",
  "Santiago",
  "Mariana",
  "Julián",
  "Lucía",
  "Mateo",
  "Isabella",
  "Sebastián",
  "Daniela",
  "Nicolás",
  "Sofía",
  "Alejandro",
  "Gabriela",
  "Tomás",
] as const;
