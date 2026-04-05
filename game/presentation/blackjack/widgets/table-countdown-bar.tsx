"use client";

import type { GamePhase } from "@/game/simulation/blackjack";
import { PHASE } from "@/game/simulation/blackjack";
import {
  BETTING_TIMER_S,
  INSURANCE_TIMER_S,
  RESULTS_TIMER_S,
  DEALER_BLACKJACK_REVEAL_S,
  COUNTDOWN_WARNING_THRESHOLD_S,
} from "@/game/simulation/blackjack";

interface TableCountdownBarProps {
  phase: GamePhase;
  countdownSec: number;
}

export function TableCountdownBar({ phase, countdownSec }: TableCountdownBarProps) {
  const total =
    phase === PHASE.BETTING
      ? BETTING_TIMER_S
      : phase === PHASE.INSURANCE
        ? INSURANCE_TIMER_S
        : phase === PHASE.RESOLVING
          ? DEALER_BLACKJACK_REVEAL_S
          : RESULTS_TIMER_S;

  const warn =
    countdownSec <= COUNTDOWN_WARNING_THRESHOLD_S &&
    phase !== PHASE.INSURANCE;

  return (
    <div className="flex items-center justify-center gap-2 mb-3">
      <div className="relative w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
          style={{
            width: `${(countdownSec / total) * 100}%`,
            backgroundColor: warn ? "#f87171" : "#34d399",
          }}
        />
      </div>
      <span
        className={`text-xs tabular-nums font-bold ${
          warn ? "text-red-400" : "text-emerald-400"
        }`}
      >
        {countdownSec}s
      </span>
    </div>
  );
}
