import type { GamePhase } from "@/game/simulation/blackjack/types";
import { PHASE } from "@/game/simulation/blackjack/game-phase";
import {
  isInitialDealOrInsuranceReveal,
  isRoundEndReveal,
} from "@/game/presentation/blackjack/lib/deal-wave-transitions";

/**
 * Presentation FSM: what the table *surface* is doing, independent of simulation phase.
 * Lets you add states (e.g. chip-flight, modal overlay) without scattering booleans.
 */
export const TABLE_SURFACE_VISUAL = {
  /** Messages, action bar, insurance row allowed (subject to sim phase). */
  HUD_INTERACTIVE: "hud_interactive",
  /** Card deal / round-end wave — suppress chrome until timer fires. */
  DEAL_WAVE_SUPPRESSED: "deal_wave_suppressed",
} as const;

export type TableSurfaceVisualState =
  (typeof TABLE_SURFACE_VISUAL)[keyof typeof TABLE_SURFACE_VISUAL];

/** Internal timed node for the deal-wave sub-state machine. */
export const DEAL_WAVE_NODE = {
  IDLE: "idle",
  TIMED_WAVE: "timed_wave",
} as const;

export type DealWavePresentationNode =
  (typeof DEAL_WAVE_NODE)[keyof typeof DEAL_WAVE_NODE];

export type TableHudVariant = "solo" | "multiplayer";

/** Multiplayer-only: when not in a timed wave, whether result row / playing HUD may show. */
export function multiplayerOverlayUnlocked(
  simPhase: GamePhase,
  prevSimPhase: GamePhase | undefined,
): boolean {
  return (
    simPhase !== PHASE.FINISHED || prevSimPhase === PHASE.FINISHED
  );
}

export function shouldEnterDealWaveTransition(
  prevSimPhase: GamePhase | undefined,
  simPhase: GamePhase,
): boolean {
  return (
    isInitialDealOrInsuranceReveal(prevSimPhase, simPhase) ||
    isRoundEndReveal(prevSimPhase, simPhase)
  );
}
