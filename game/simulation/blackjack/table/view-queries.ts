import type { ClientGameState, GameState } from "../model/types";
import { PHASE } from "../meta/game-phase";

type TurnSlice = Pick<GameState, "phase" | "players" | "activePlayerIndex">;

/**
 * Read-only session helper for UI and networking (no engine imports).
 * Works for full {@link GameState} or {@link ClientGameState}.
 */
export function isActivePlayingTurnForPlayer(
  state: TurnSlice | ClientGameState,
  playerId: string,
): boolean {
  return (
    state.phase === PHASE.PLAYING &&
    state.players[state.activePlayerIndex]?.id === playerId
  );
}
