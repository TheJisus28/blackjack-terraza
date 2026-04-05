import { PHASE, type GamePhase } from "../meta/game-phase";
import type { TableStatus } from "../model/types";

/** `game_tables.status` after a successful POST .../action (lobby list). */
export function lobbyTableStatusAfterEngineStep(phase: GamePhase): TableStatus {
  if (phase === PHASE.WAITING || phase === PHASE.FINISHED) return "waiting";
  return "playing";
}

/** `game_tables.status` after join/leave mutates the player list. */
export function lobbyTableStatusAfterSeatEvent(phase: GamePhase): TableStatus {
  if (phase === PHASE.FINISHED) return "waiting";
  if (
    phase === PHASE.PLAYING ||
    phase === PHASE.BETTING ||
    phase === PHASE.INSURANCE ||
    phase === PHASE.RESOLVING
  ) {
    return "playing";
  }
  return "waiting";
}
