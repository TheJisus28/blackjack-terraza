// ── Deck & shoe ──
export const DEFAULT_DECK_COUNT = 6;

// ── Chips & bets ──
export const STARTING_CHIPS = 1000;
export const REBUY_CHIPS = 300;
export const DEFAULT_MIN_BET = 10;
export const DEFAULT_MAX_BET = 999_999_999;

// ── Hand rules ──
export const BLACKJACK_VALUE = 21;
export const DEALER_STAND_VALUE = 17;
export const BLACKJACK_PAYOUT_MULTIPLIER = 2.5; // 3:2
export const WIN_PAYOUT_MULTIPLIER = 2;          // 1:1 (bet returned + equal winnings)
export const SURRENDER_RETURN_RATIO = 0.5;
export const INITIAL_DEAL_ROUNDS = 2;

// ── Multiplayer timers ──
export const RESULTS_TIMER_S = 5;   // seconds clients show results before clearing
/** En los últimos N segundos de esa ventana, recarga automática (+300) si no alcanzan la apuesta mínima */
export const RESULTS_REBUY_LEAD_S = 2;
export const BETTING_TIMER_S = 20;  // seconds clients have to place bets
export const INSURANCE_TIMER_S = 12;  // seconds to accept/decline insurance (As del crupier)
// Server-side validation buffers (slightly less to tolerate network latency)
export const RESULTS_DELAY_MS = (RESULTS_TIMER_S - 1) * 1000;
export const BETTING_DELAY_MS = (BETTING_TIMER_S - 1) * 1000;
export const INSURANCE_DELAY_MS = (INSURANCE_TIMER_S - 1) * 1000;

// ── Inactivity ──
export const MAX_INACTIVE_ROUNDS = 3;

// ── UI animation timing (~40% más rápido que la versión original) ──
export const CARD_ANIM_DELAY_PER_CARD_MS = 270;
/** Duración de `cardDeal` / `cardFlip` en Card.tsx (debe coincidir con el style inline) */
export const CARD_DEAL_DURATION_MS = 600;
/** Entre cartas en la mesa: una animación termina antes de empezar la siguiente (jugador/crupier comparten cola) */
export const CARD_SEQUENTIAL_STEP_MS = CARD_DEAL_DURATION_MS + 84;
export const CARD_ANIM_BASE_DELAY_MS = 480;
export const COUNTDOWN_WARNING_THRESHOLD_S = 5;
