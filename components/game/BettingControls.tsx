"use client";

import { useEffect, useCallback, useState } from "react";
import { sounds } from "@/lib/sounds";
import { CHIP_COLORS, CHIP_VALUES, KEY_TO_CHIP } from "./chipConstants";

interface BettingControlsProps {
  minBet: number;
  maxBet: number;
  chips: number;
  onBet: (amount: number) => void;
}

export function BettingControls({
  minBet,
  maxBet,
  chips,
  onBet,
}: BettingControlsProps) {
  const [currentBet, setCurrentBet] = useState(0);

  const effectiveMax = maxBet >= 999_999 ? chips : Math.min(maxBet, chips);

  const addChip = useCallback((value: number) => {
    sounds.chipPlace();
    setCurrentBet((prev) => Math.min(prev + value, effectiveMax));
  }, [effectiveMax]);

  const clearBet = useCallback(() => setCurrentBet(0), []);

  const handleBet = useCallback(() => {
    if (currentBet >= minBet && currentBet <= chips) {
      onBet(currentBet);
    }
  }, [currentBet, minBet, chips, onBet]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Enter") {
        e.preventDefault();
        handleBet();
        return;
      }

      if (e.key === "0" || e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        clearBet();
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
  }, [addChip, clearBet, handleBet, chips]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-emerald-300 text-sm font-medium uppercase tracking-wider mb-1">
          {currentBet > 0 ? "Tu apuesta" : `Mínimo $${minBet}`}
        </p>
        <p className={`text-4xl font-bold tabular-nums ${currentBet > 0 ? "text-white" : "text-white/30"}`}>
          ${currentBet}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {CHIP_VALUES.filter((v) => v <= chips).map((value, idx) => (
          <button
            key={value}
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

      <div className="flex gap-3">
        <button
          onClick={clearBet}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all cursor-pointer"
        >
          Limpiar
        </button>
        <button
          onClick={handleBet}
          disabled={currentBet < minBet || currentBet > chips}
          className="px-8 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed
            text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all active:scale-95 cursor-pointer"
        >
          Repartir
        </button>
      </div>
    </div>
  );
}
