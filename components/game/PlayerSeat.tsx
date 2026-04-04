"use client";

import type { Player } from "@/lib/blackjack/types";
import { HandDisplay } from "./HandDisplay";

interface PlayerSeatProps {
  player: Player;
  isCurrentTurn: boolean;
  isMe: boolean;
}

export function PlayerSeat({ player, isCurrentTurn, isMe }: PlayerSeatProps) {
  return (
    <div
      className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all
        ${isCurrentTurn ? "bg-emerald-500/10 border border-emerald-500/20 scale-105" : "bg-white/[0.02] border border-white/[0.05]"}
        ${isMe ? "ring-1 ring-emerald-400/30" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-semibold ${isMe ? "text-emerald-300" : "text-white"}`}
        >
          {player.name}
          {isMe && (
            <span className="text-[10px] text-emerald-400/60 ml-1">(tu)</span>
          )}
        </span>
        <span className="text-xs text-yellow-300/70 tabular-nums">
          ${player.chips}
        </span>
      </div>

      {player.hands.length > 0 ? (
        <div className="flex gap-3 flex-wrap justify-center">
          {player.hands.map((hand, i) => (
            <HandDisplay
              key={i}
              hand={hand}
              isActive={isCurrentTurn && player.activeHandIndex === i}
              label={player.hands.length > 1 ? `M${i + 1}` : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">Esperando apuesta...</p>
      )}
    </div>
  );
}
