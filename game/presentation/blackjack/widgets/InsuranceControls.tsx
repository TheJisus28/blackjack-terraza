"use client";

import { useCallback, useEffect, useState } from "react";
import { sounds } from "@/shared/audio/sounds";
import {
  CHIP_COLORS,
  CHIP_VALUES,
  KEY_TO_CHIP,
} from "@/game/presentation/blackjack/fx/chip-constants";

interface InsuranceControlsProps {
  maxInsurance: number;
  chips: number;
  onConfirm: (amount: number) => void;
  onDecline: () => void;
  countdownSec?: number | null;
}

const MIN_INSURANCE = 1;

export function InsuranceControls({
  maxInsurance,
  chips,
  onConfirm,
  onDecline,
  countdownSec,
}: InsuranceControlsProps) {
  const [current, setCurrent] = useState(0);

  const effectiveMax = Math.min(maxInsurance, chips);

  const addChip = useCallback(
    (value: number) => {
      sounds.chipPlace();
      setCurrent((prev) => Math.min(prev + value, effectiveMax));
    },
    [effectiveMax],
  );

  const clear = useCallback(() => setCurrent(0), []);

  const handleConfirm = useCallback(() => {
    if (current >= MIN_INSURANCE && current <= effectiveMax) {
      onConfirm(current);
    }
  }, [current, effectiveMax, onConfirm]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
        return;
      }

      if (e.key === "0" || e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        clear();
        return;
      }

      const chipValue = KEY_TO_CHIP[e.key];
      if (chipValue && chipValue <= chips) {
        e.preventDefault();
        addChip(chipValue);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [addChip, clear, handleConfirm, chips]);

  return (
    <div className="flex flex-col items-center gap-4 px-4">
      <p className="text-center text-xs text-amber-200/80 max-w-sm">
        Dealer shows an ace — insurance up to half your bet (pays 2:1 if dealer has blackjack).
      </p>

      <div className="text-center">
        <p className="text-amber-300 text-sm font-medium uppercase tracking-wider mb-1">
          {current > 0 ? "Your insurance" : `Max $${effectiveMax}`}
        </p>
        <p
          className={`text-4xl font-bold tabular-nums ${current > 0 ? "text-white" : "text-white/30"}`}
        >
          ${current}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {CHIP_VALUES.filter((v) => v <= chips && v <= effectiveMax).map((value, idx) => (
          <button
            key={value}
            type="button"
            onClick={() => addChip(value)}
            className={`relative w-14 h-14 rounded-full bg-gradient-to-b ${CHIP_COLORS[value]} border-2 
              flex items-center justify-center text-white font-bold text-xs
              transition-all hover:scale-110 active:scale-95 shadow-lg cursor-pointer`}
          >
            ${value}
            <span className="absolute -top-1 -right-1 hidden lg:flex w-5 h-5 rounded bg-black/70 text-[10px] text-white/70 items-center justify-center font-mono">
              {idx + 1}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={clear}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all cursor-pointer"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onDecline}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium border border-white/15 transition-all cursor-pointer"
        >
          No thanks
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={current < MIN_INSURANCE || current > effectiveMax}
          className="px-8 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed
            text-white font-bold text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
        >
          Confirm insurance
        </button>
      </div>

      {countdownSec != null && countdownSec > 0 && (
        <p className="text-xs text-gray-400 tabular-nums">Insurance: {countdownSec}s</p>
      )}
    </div>
  );
}
