import {
  type GamePhase,
  type TableCardLayout,
  PHASE,
  feedbackWaveDurationMs,
  maxDealGlobalIndex,
  totalCardsOnTable,
  CARD_ANIM_BASE_DELAY_MS,
} from "@/game/simulation/blackjack";

/** Betting → first cards / insurance / instant finish (e.g. dealer BJ peek). */
export function isInitialDealOrInsuranceReveal(
  prevPhase: GamePhase | undefined,
  phase: GamePhase,
): boolean {
  return (
    prevPhase === PHASE.BETTING &&
    (phase === PHASE.PLAYING ||
      phase === PHASE.FINISHED ||
      phase === PHASE.INSURANCE ||
      phase === PHASE.RESOLVING)
  );
}

/** Active round → results: dealer finished drawing and payouts computed. */
export function isRoundEndReveal(
  prevPhase: GamePhase | undefined,
  phase: GamePhase,
): boolean {
  return (
    (prevPhase === PHASE.PLAYING ||
      prevPhase === PHASE.DEALER_TURN ||
      prevPhase === PHASE.INSURANCE ||
      prevPhase === PHASE.RESOLVING) &&
    phase === PHASE.FINISHED
  );
}

/** Delay before showing post-deal UI (messages, action bar), aligned with card wave + padding. */
export function dealWaveChromeDelayMs(
  layout: TableCardLayout,
  previousMaxGlobal: number,
): number {
  const dealMs = feedbackWaveDurationMs(layout, previousMaxGlobal);
  return dealMs <= 0
    ? CARD_ANIM_BASE_DELAY_MS
    : dealMs + CARD_ANIM_BASE_DELAY_MS;
}

/**
 * Next value for the ref that tracks max global deal index for {@link feedbackWaveDurationMs}.
 * Returns `null` if the ref should stay unchanged (e.g. finished round with cards still on table).
 */
export function nextFeedbackMaxGlobal(
  layout: TableCardLayout,
  phase: GamePhase,
): number | null {
  const total = totalCardsOnTable(layout);
  const maxG = maxDealGlobalIndex(layout);
  if (total === 0) return -1;
  if (phase !== PHASE.FINISHED) return maxG;
  return null;
}
