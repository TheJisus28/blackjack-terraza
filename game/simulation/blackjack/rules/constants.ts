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
/** In the last N seconds of that window, auto-rebuy (+REBUY_CHIPS) if below min bet */
export const RESULTS_REBUY_LEAD_S = 2;
/** Pause before paying losing hands when dealer has natural and no player has blackjack (same pacing as results). */
export const DEALER_BLACKJACK_REVEAL_S = RESULTS_TIMER_S;
export const BETTING_TIMER_S = 20;  // seconds clients have to place bets
/** Same window as betting: accept/decline insurance when dealer shows ace */
export const INSURANCE_TIMER_S = BETTING_TIMER_S;
// Server-side validation buffers (slightly less to tolerate network latency)
export const RESULTS_DELAY_MS = (RESULTS_TIMER_S - 1) * 1000;
export const DEALER_BLACKJACK_REVEAL_DELAY_MS =
  (DEALER_BLACKJACK_REVEAL_S - 1) * 1000;
export const BETTING_DELAY_MS = (BETTING_TIMER_S - 1) * 1000;
export const INSURANCE_DELAY_MS = (INSURANCE_TIMER_S - 1) * 1000;

// ── Inactivity ──
export const MAX_INACTIVE_ROUNDS = 3;

// ── Presence (multiplayer) ──
/** No heartbeat within this window ⇒ treated as offline for spectator kick logic */
export const PLAYER_OFFLINE_THRESHOLD_MS = 45_000;
/** Remove offline spectators after this many completed rounds (finished → betting). */
export const OFFLINE_SPECTATOR_KICK_MIN_ROUNDS = 3;

// ── UI animation timing (~15% faster than original 450/1000/140/800) ──
/** Card deal uses `cardDeal` in app/globals.css; duration ms in Card.tsx. Table chip stack has no animation. */
export const CARD_ANIM_DELAY_PER_CARD_MS = 383;
/** Duration of `cardDeal` / `cardFlip` in Card.tsx (must match inline style) */
export const CARD_DEAL_DURATION_MS = 850;
/** Gap between cards on the table: one deal animation finishes before the next starts (shared queue) */
export const CARD_SEQUENTIAL_STEP_MS = CARD_DEAL_DURATION_MS + 119;
export const CARD_ANIM_BASE_DELAY_MS = 680;
/** Extra ms after nominal `cardDeal` end before showing hand total / status (timers vs CSS). */
export const CARD_TOTAL_REVEAL_BUFFER_MS = 90;
export const COUNTDOWN_WARNING_THRESHOLD_S = 5;
