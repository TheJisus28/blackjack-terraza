"use client";

import { useEffect, useState } from "react";
import type { GamePhase } from "@/game/simulation/blackjack";
import { PHASE } from "@/game/simulation/blackjack";
import { INSURANCE_TIMER_S } from "@/game/simulation/blackjack";

/** UI countdown for the insurance decision window (solo or any client-local mirror of server time). */
export function useInsuranceCountdown(
  phase: GamePhase,
  insuranceStartedAt: number | undefined,
): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (phase !== PHASE.INSURANCE || insuranceStartedAt == null) {
      setSecondsLeft(null);
      return;
    }

    const tick = () => {
      const elapsed = (Date.now() - insuranceStartedAt) / 1000;
      setSecondsLeft(Math.max(0, Math.ceil(INSURANCE_TIMER_S - elapsed)));
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [phase, insuranceStartedAt]);

  return secondsLeft;
}
