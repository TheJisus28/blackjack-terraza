"use client";

import type { GameState, PlayerAction } from "@/lib/blackjack/types";
import { canDoubleDown, canSplit, canSurrender } from "@/lib/blackjack/hand";

interface ActionBarProps {
  gameState: GameState;
  onAction: (action: PlayerAction) => void;
}

export function ActionBar({ gameState, onAction }: ActionBarProps) {
  const player = gameState.players[gameState.activePlayerIndex];
  if (!player) return null;

  const hand = player.hands[player.activeHandIndex];
  if (!hand || hand.status !== "playing") return null;

  const showSplit = canSplit(hand) && player.chips >= hand.bet;
  const showDouble = canDoubleDown(hand) && player.chips >= hand.bet;
  const showSurrender = canSurrender(hand);

  return (
    <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
      <ActionButton
        onClick={() => onAction("hit")}
        variant="primary"
        label="Pedir"
        shortcut="H"
      />
      <ActionButton
        onClick={() => onAction("stand")}
        variant="secondary"
        label="Plantarse"
        shortcut="S"
      />
      {showDouble && (
        <ActionButton
          onClick={() => onAction("double")}
          variant="accent"
          label="Doblar"
          shortcut="D"
        />
      )}
      {showSplit && (
        <ActionButton
          onClick={() => onAction("split")}
          variant="accent"
          label="Dividir"
          shortcut="P"
        />
      )}
      {showSurrender && (
        <ActionButton
          onClick={() => onAction("surrender")}
          variant="danger"
          label="Rendirse"
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
