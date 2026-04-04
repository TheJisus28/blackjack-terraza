"use client";

import type { Player } from "@/lib/blackjack/types";
import { HandDisplay } from "./HandDisplay";

interface PlayerSeatProps {
  player: Player;
  isCurrentTurn: boolean;
  isMe: boolean;
}

const AVATAR_COLORS = [
  "from-blue-500 to-blue-700",
  "from-purple-500 to-purple-700",
  "from-pink-500 to-pink-700",
  "from-amber-500 to-amber-700",
  "from-teal-500 to-teal-700",
  "from-red-500 to-red-700",
  "from-indigo-500 to-indigo-700",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function PlayerSeat({ player, isCurrentTurn, isMe }: PlayerSeatProps) {
  const initial = player.name.charAt(0).toUpperCase();
  const avatarColor = getAvatarColor(player.name);

  return (
    <div
      className={`flex flex-col items-center gap-1 transition-all duration-300
        ${isCurrentTurn ? "scale-105 drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]" : ""}
      `}
    >
      {/* Cards */}
      {player.hands.length > 0 && player.hands.some(h => h.cards.length > 0) && (
        <div className="flex gap-1.5 flex-wrap justify-center mb-1 table-cards-scale">
          {player.hands.map((hand, i) => (
            <HandDisplay
              key={i}
              hand={hand}
              isActive={isCurrentTurn && player.activeHandIndex === i}
              label={player.hands.length > 1 ? `M${i + 1}` : undefined}
            />
          ))}
        </div>
      )}

      {/* Bet circle when no cards */}
      {(player.hands.length === 0 || player.hands.every(h => h.cards.length === 0)) && (
        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-dashed
          ${isCurrentTurn ? "border-emerald-400/50" : "border-white/10"}
          flex items-center justify-center mb-1`}
        >
          {player.hands[0]?.bet > 0 ? (
            <span className="text-[10px] text-yellow-300/70 font-semibold">${player.hands[0].bet}</span>
          ) : (
            <span className="text-[9px] text-white/15 uppercase">Apuesta</span>
          )}
        </div>
      )}

      {/* Avatar + info */}
      <div className="flex flex-col items-center gap-0.5">
        <div
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br ${avatarColor}
            flex items-center justify-center text-white text-[10px] sm:text-xs font-bold shadow-md
            ${isMe ? "ring-2 ring-emerald-400 ring-offset-1 ring-offset-transparent" : ""}
            ${isCurrentTurn ? "animate-pulse" : ""}
          `}
        >
          {initial}
        </div>
        <span
          className={`text-[9px] sm:text-[10px] font-medium max-w-[60px] truncate leading-tight
            ${isMe ? "text-emerald-300" : "text-white/60"}`}
        >
          {player.name}
        </span>
        <span className="text-[8px] sm:text-[9px] text-yellow-300/50 tabular-nums font-medium">
          ${player.chips}
        </span>
      </div>
    </div>
  );
}

/**
 * Distributes seats evenly across the bottom of the table in a subtle arc.
 * Uses flexbox for robust layout instead of absolute positioning.
 */
export function SeatsArc({
  children,
  count,
}: {
  children: React.ReactNode[];
  count: number;
}) {
  // Vertical offset per seat to create the arc curve (edges higher, center lower)
  function getArcOffset(index: number, total: number): number {
    if (total <= 1) return 0;
    const mid = (total - 1) / 2;
    const dist = Math.abs(index - mid) / mid;
    return dist * 12; // edges raised by up to 12px
  }

  return (
    <div className="flex items-end justify-evenly w-full gap-1">
      {children.map((child, i) => (
        <div
          key={i}
          className="flex-shrink min-w-0"
          style={{ marginBottom: `${getArcOffset(i, count)}px` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
