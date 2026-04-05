"use client";

import { useEffect, useState } from "react";
import type { GameState, Player } from "@/game/simulation/blackjack/types";
import { HandDisplay } from "./HandDisplay";
import { ChipStack } from "./ChipStack";

interface PlayerSeatProps {
  player: Player;
  playerIndex: number;
  tableLayout: Pick<GameState, "players" | "dealer">;
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

export function PlayerSeat({
  player,
  playerIndex,
  tableLayout,
  isCurrentTurn,
  isMe,
}: PlayerSeatProps) {
  const initial = player.name.charAt(0).toUpperCase();
  const avatarColor = getAvatarColor(player.name);

  return (
    <div
      className={`flex flex-col items-center gap-1 transition-all duration-300
        ${isCurrentTurn ? "scale-105 drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]" : ""}
      `}
    >
      {/* Cards + chips */}
      {player.hands.length > 0 && player.hands.some(h => h.cards.length > 0) && (
        <div className="flex gap-1.5 flex-wrap justify-center items-end mb-1">
          {player.hands.map((hand, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <HandDisplay
                hand={hand}
                tableLayout={tableLayout}
                playerIndex={playerIndex}
                handIndex={i}
                isActive={isCurrentTurn && player.activeHandIndex === i}
                label={player.hands.length > 1 ? `M${i + 1}` : undefined}
              />
              {hand.bet > 0 && <ChipStack amount={hand.bet} />}
            </div>
          ))}
        </div>
      )}

      {/* Avatar + info */}
      <div className="flex flex-col items-center gap-0.5 lg:gap-1">
        <div
          className={`w-7 h-7 sm:w-8 sm:h-8 lg:w-11 lg:h-11 rounded-full bg-gradient-to-br ${avatarColor}
            flex items-center justify-center text-white text-[10px] sm:text-xs lg:text-base font-bold shadow-md
            ${isMe ? "ring-2 ring-emerald-400 ring-offset-1 ring-offset-transparent" : ""}
            ${isCurrentTurn ? "animate-pulse" : ""}
          `}
        >
          {initial}
        </div>
        <span
          className={`text-[9px] sm:text-[10px] lg:text-sm font-medium max-w-[60px] lg:max-w-[100px] truncate leading-tight
            ${isMe ? "text-emerald-300" : "text-white/70"}`}
        >
          {player.name}
        </span>
        <span className="text-[8px] sm:text-[9px] lg:text-xs text-yellow-300/60 tabular-nums font-semibold">
          ${player.chips}
        </span>
      </div>
    </div>
  );
}

/**
 * Distributes seats evenly across the bottom of the table in a subtle arc.
 * Uses flexbox + dynamic zoom so seats scale down with more players.
 */
function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return desktop;
}

export function SeatsArc({
  children,
  count,
}: {
  children: React.ReactNode[];
  count: number;
}) {
  const isDesktop = useIsDesktop();

  function getArcOffset(index: number, total: number): number {
    if (total <= 1) return 0;
    const mid = (total - 1) / 2;
    const dist = Math.abs(index - mid) / mid;
    return dist * (total <= 3 ? (isDesktop ? 16 : 10) : (isDesktop ? 10 : 6));
  }

  const seatZoom = isDesktop
    ? (count <= 1 ? 1.3 :
       count <= 2 ? 1.2 :
       count <= 3 ? 1.1 :
       count <= 4 ? 0.95 :
       count <= 5 ? 0.82 :
       0.7)
    : (count <= 1 ? 0.9 :
       count <= 2 ? 0.82 :
       count <= 3 ? 0.72 :
       count <= 4 ? 0.62 :
       count <= 5 ? 0.55 :
       0.48);

  return (
    <div className="flex items-end justify-evenly w-full">
      {children.map((child, i) => (
        <div
          key={i}
          className="flex-shrink min-w-0"
          style={{
            zoom: seatZoom,
            marginBottom: `${getArcOffset(i, count)}px`,
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
