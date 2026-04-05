import { type GamePhase, PHASE } from "@/game/simulation/blackjack";
import {
  isInitialDealOrInsuranceReveal,
  isRoundEndReveal,
} from "./deal-wave-transitions";

/**
 * Presentation FSM: what the table *surface* is doing, independent of simulation phase.
 * Lets you add states (e.g. chip-flight, modal overlay) without scattering booleans.
 */

/** Internal timed node for the deal-wave sub-state machine. */
export const DEAL_WAVE_NODE = {
  IDLE: "idle",
  TIMED_WAVE: "timed_wave",
} as const;

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
