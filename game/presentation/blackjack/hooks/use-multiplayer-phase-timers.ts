"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientGameState } from "@/game/simulation/blackjack/types";
import { PHASE } from "@/game/simulation/blackjack/game-phase";
import {
  RESULTS_TIMER_S,
  RESULTS_REBUY_LEAD_S,
  BETTING_TIMER_S,
  INSURANCE_TIMER_S,
  COUNTDOWN_WARNING_THRESHOLD_S,
} from "@/game/simulation/blackjack/constants";
import { sounds } from "@/shared/audio/sounds";
import {
  SESSION_TIMER_ACTION,
  type BlackjackSessionTimerAction,
} from "@/shared/types/blackjack-session-action";

/**
 * Authoritative timers live on the server; this hook mirrors them for UI (countdown, tick SFX, auto RPCs).
 */
export function useMultiplayerPhaseTimers(
  gameState: ClientGameState | null | undefined,
  sendAction: (action: BlackjackSessionTimerAction) => void,
): { countdownSec: number | null } {
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerSentRef = useRef(false);
  const autoRebuyResultsSentRef = useRef(false);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    autoRebuyResultsSentRef.current = false;
  }, [gameState?.phase, gameState?.roundEndedAt]);

  useEffect(() => {
    if (!gameState) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    if (gameState.phase === PHASE.FINISHED && gameState.roundEndedAt != null) {
      timerSentRef.current = false;
      interval = setInterval(() => {
        const elapsed = (Date.now() - gameState.roundEndedAt!) / 1000;
        const remaining = Math.max(0, RESULTS_TIMER_S - elapsed);
        setCountdown(Math.ceil(remaining));

        const anyBelowMin = gameState.players.some(
          (p) => p.chips < gameState.minBet,
        );
        if (
          anyBelowMin &&
          remaining <= RESULTS_REBUY_LEAD_S &&
          remaining > 0 &&
          !autoRebuyResultsSentRef.current
        ) {
          autoRebuyResultsSentRef.current = true;
          sendAction(SESSION_TIMER_ACTION.AUTO_REBUY_RESULTS);
        }

        if (remaining <= 0 && !timerSentRef.current) {
          timerSentRef.current = true;
          sendAction(SESSION_TIMER_ACTION.AUTO_CLEAR);
        }
      }, 250);
    } else if (
      gameState.phase === PHASE.BETTING &&
      gameState.bettingStartedAt != null
    ) {
      timerSentRef.current = false;
      lastTickRef.current = null;
      interval = setInterval(() => {
        const elapsed = (Date.now() - gameState.bettingStartedAt!) / 1000;
        const remaining = Math.max(0, BETTING_TIMER_S - elapsed);
        const rounded = Math.ceil(remaining);
        setCountdown(rounded);

        if (
          rounded > 0 &&
          rounded <= COUNTDOWN_WARNING_THRESHOLD_S &&
          rounded !== lastTickRef.current
        ) {
          lastTickRef.current = rounded;
          sounds.tick();
        }

        if (remaining <= 0 && !timerSentRef.current) {
          timerSentRef.current = true;
          sendAction(SESSION_TIMER_ACTION.AUTO_DEAL);
        }
      }, 250);
    } else if (
      gameState.phase === PHASE.INSURANCE &&
      gameState.insuranceStartedAt != null
    ) {
      timerSentRef.current = false;
      interval = setInterval(() => {
        const elapsed = (Date.now() - gameState.insuranceStartedAt!) / 1000;
        const remaining = Math.max(0, INSURANCE_TIMER_S - elapsed);
        setCountdown(Math.ceil(remaining));

        if (remaining <= 0 && !timerSentRef.current) {
          timerSentRef.current = true;
          sendAction(SESSION_TIMER_ACTION.AUTO_INSURANCE);
        }
      }, 250);
    } else {
      setCountdown(null);
      lastTickRef.current = null;
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [
    gameState?.phase,
    gameState?.roundEndedAt,
    gameState?.bettingStartedAt,
    gameState?.insuranceStartedAt,
    gameState?.players,
    gameState?.minBet,
    sendAction,
  ]);

  return { countdownSec: countdown };
}
