"use client";

import { useEffect } from "react";
import type { GamePhase, PlayerAction } from "@/game/simulation/blackjack/types";
import { PHASE } from "@/game/simulation/blackjack/game-phase";
import { PLAYER_ACTION } from "@/game/simulation/blackjack/player-action-kind";

const KEY_MAP: Record<string, PlayerAction> = {
  h: PLAYER_ACTION.HIT,
  s: PLAYER_ACTION.STAND,
  d: PLAYER_ACTION.DOUBLE,
  p: PLAYER_ACTION.SPLIT,
  r: PLAYER_ACTION.SURRENDER,
};

/**
 * Command-style input: map keys → {@link PlayerAction} while the local player may act.
 */
export function useBlackjackPlayingHotkeys(
  phase: GamePhase | undefined,
  enabled: boolean,
  onAction: (action: PlayerAction) => void,
): void {
  useEffect(() => {
    if (phase !== PHASE.PLAYING || !enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      const act = KEY_MAP[e.key.toLowerCase()];
      if (act) {
        e.preventDefault();
        onAction(act);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, enabled, onAction]);
}
