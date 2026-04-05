"use client";

import { useEffect, useCallback } from "react";
import type { GameState, PlayerAction } from "@/game/simulation/blackjack";
import { canDoubleDown, canSplit, canSurrender } from "@/game/simulation/blackjack";

interface ActionBarProps {
  gameState: GameState;
  onAction: (action: PlayerAction) => void;
}

export function ActionBar({ gameState, onAction }: ActionBarProps) {
  const player = gameState.players[gameState.activePlayerIndex];
  const hand = player?.hands[player.activeHandIndex];
  const isActive = hand && hand.status === "playing";

  const showSplit = isActive && canSplit(hand) && player.chips >= hand.bet;
  const doubleExtra = Math.min(hand.bet, player.chips);
  const showDouble =
    isActive && canDoubleDown(hand) && player.chips >= 1;
  const showSurrender = isActive && canSurrender(hand);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      if (key === "h") { e.preventDefault(); onAction("hit"); }
      else if (key === "s") { e.preventDefault(); onAction("stand"); }
      else if (key === "d" && showDouble) { e.preventDefault(); onAction("double"); }
      else if (key === "p" && showSplit) { e.preventDefault(); onAction("split"); }
      else if (key === "r" && showSurrender) { e.preventDefault(); onAction("surrender"); }
    },
    [isActive, showDouble, showSplit, showSurrender, onAction],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  if (!player || !isActive) return null;

  return (
    <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
      <ActionButton
        onClick={() => onAction("hit")}
        variant="primary"
        label="Hit"
        shortcut="H"
      />
      <ActionButton
        onClick={() => onAction("stand")}
        variant="secondary"
        label="Stand"
        shortcut="S"
      />
      {showDouble && (
        <ActionButton
          onClick={() => onAction("double")}
          variant="accent"
          label={
            doubleExtra < hand.bet
              ? `Double +$${doubleExtra}`
              : "Double"
          }
          shortcut="D"
        />
      )}
      {showSplit && (
        <ActionButton
          onClick={() => onAction("split")}
          variant="accent"
          label="Split"
          shortcut="P"
        />
      )}
      {showSurrender && (
        <ActionButton
          onClick={() => onAction("surrender")}
          variant="danger"
          label="Surrender"
          shortcut="R"
        />
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  variant,
  label,
  shortcut,
}: {
  onClick: () => void;
  variant: "primary" | "secondary" | "accent" | "danger";
  label: string;
  shortcut: string;
}) {
  const styles = {
    primary:
      "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25",
    secondary:
      "bg-white/10 hover:bg-white/20 text-white border border-white/20",
    accent:
      "bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/25",
    danger: "bg-red-500/80 hover:bg-red-500 text-white",
  };

  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 lg:px-6 lg:py-3 rounded-xl font-semibold text-sm lg:text-base transition-all active:scale-95 cursor-pointer ${styles[variant]}`}
    >
      {label}
      <kbd className="ml-1.5 text-[10px] opacity-60 hidden sm:inline">
        {shortcut}
      </kbd>
    </button>
  );
}
