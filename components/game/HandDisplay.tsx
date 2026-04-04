"use client";

import type { Hand } from "@/lib/blackjack/types";
import { getHandValue } from "@/lib/blackjack/hand";
import { Card } from "./Card";

interface HandDisplayProps {
  hand: Hand;
  isActive?: boolean;
  label?: string;
  showValue?: boolean;
}

export function HandDisplay({
  hand,
  isActive = false,
  label,
  showValue = true,
}: HandDisplayProps) {
  const value = getHandValue(hand.cards);
  const visibleCards = hand.cards.filter((c) => c.faceUp);
  const hasHidden = hand.cards.some((c) => !c.faceUp);

  const statusColors: Record<string, string> = {
    blackjack: "text-yellow-400",
    busted: "text-red-400",
    standing: "text-blue-300",
    surrendered: "text-gray-400",
    playing: "text-white",
  };

  const statusLabels: Record<string, string> = {
    blackjack: "BLACKJACK!",
    busted: "BUST",
    standing: "PLANTADO",
    surrendered: "RENDIDO",
    playing: "",
  };

  const totalDelay = hand.cards.length * 250 + 200;

  return (
    <div
      className={`flex flex-col items-center gap-2 transition-transform duration-300 ${isActive ? "scale-105" : ""}`}
    >
      {label && (
        <span className="text-xs font-medium text-emerald-300 uppercase tracking-wider">
          {label}
        </span>
      )}

      <div className="flex -space-x-6">
        {hand.cards.map((card, i) => (
          <Card key={`${card.rank}-${card.suit}-${i}`} card={card} index={i} />
        ))}
      </div>

      {showValue && hand.cards.length > 0 && (
        <div
          className="flex items-center gap-2"
          style={{
            animation: `fadeInUp 0.4s ease-out ${totalDelay}ms both`,
          }}
        >
          <span
            className={`text-lg font-bold tabular-nums ${statusColors[hand.status]}`}
          >
            {hasHidden ? `${getHandValue(visibleCards)}` : value}
          </span>
          {hand.status !== "playing" && statusLabels[hand.status] && (
            <span
              className={`text-xs font-bold uppercase ${statusColors[hand.status]}`}
            >
              {statusLabels[hand.status]}
            </span>
          )}
          {hand.bet > 0 && (
            <span className="text-xs text-yellow-300/70">${hand.bet}</span>
          )}
        </div>
      )}

      {isActive && (
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      )}
    </div>
  );
}
