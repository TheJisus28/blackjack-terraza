"use client";

import { useMemo, useCallback } from "react";
import type { Hand } from "@/lib/blackjack/types";
import { getHandValue } from "@/lib/blackjack/hand";
import {
  assignGlobalDealIndices,
  dealLayoutSignature,
  playerCardKey,
  type TableCardLayout,
} from "@/lib/blackjack/deal-sequence";
import { CARD_SEQUENTIAL_STEP_MS } from "@/lib/blackjack/constants";
import { useSequentialRevealCount } from "@/hooks/use-sequential-reveal-count";
import { Card } from "./Card";

interface HandDisplayProps {
  hand: Hand;
  tableLayout: TableCardLayout;
  playerIndex: number;
  handIndex: number;
  isActive?: boolean;
  label?: string;
  showValue?: boolean;
}

export function HandDisplay({
  hand,
  tableLayout,
  playerIndex,
  handIndex,
  isActive = false,
  label,
  showValue = true,
}: HandDisplayProps) {
  const layoutSig = dealLayoutSignature(tableLayout);
  const indexMap = useMemo(
    () => assignGlobalDealIndices(tableLayout),
    [layoutSig],
  );

  const resolveGlobalIndex = useCallback(
    (ci: number) => indexMap.get(playerCardKey(playerIndex, handIndex, ci)) ?? 0,
    [indexMap, playerIndex, handIndex],
  );

  const revealedCount = useSequentialRevealCount(hand.cards.length, resolveGlobalIndex);
  const cardsForTotal = hand.cards.slice(0, revealedCount);
  const value = getHandValue(cardsForTotal);
  const visibleForTotal = cardsForTotal.filter((c) => c.faceUp);
  const hasHidden = hand.cards.some((c) => !c.faceUp);
  const totalIsSynced = revealedCount >= hand.cards.length;
  const displayStatus = totalIsSynced ? hand.status : "playing";

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

  const displayTotal = hasHidden ? getHandValue(visibleForTotal) : value;

  return (
    <div
      className={`flex flex-col items-center gap-2 transition-transform duration-300 ${isActive ? "scale-105" : ""}`}
    >
      {label && (
        <span className="text-xs font-medium text-emerald-300 uppercase tracking-wider">
          {label}
        </span>
      )}

      <div className="flex -space-x-6 lg:-space-x-7">
        {hand.cards.map((card, i) => (
          <Card
            key={`p${playerIndex}-h${handIndex}-${i}-${card.rank}-${card.suit}`}
            card={card}
            index={i}
            dealDelayMs={
              (indexMap.get(playerCardKey(playerIndex, handIndex, i)) ?? 0) *
              CARD_SEQUENTIAL_STEP_MS
            }
          />
        ))}
      </div>

      {showValue && hand.cards.length > 0 && revealedCount > 0 && (
        <div className="flex items-center gap-2">
          <span
            key={revealedCount}
            className={`text-lg lg:text-xl font-bold tabular-nums ${statusColors[displayStatus]}`}
            style={{ animation: "fadeInUp 0.35s ease-out both" }}
          >
            {hasHidden ? `${getHandValue(visibleForTotal)}` : displayTotal}
          </span>
          {totalIsSynced &&
            hand.status !== "playing" &&
            statusLabels[hand.status] && (
            <span
              className={`text-xs lg:text-sm font-bold uppercase ${statusColors[hand.status]}`}
            >
              {statusLabels[hand.status]}
            </span>
          )}
        </div>
      )}

      {isActive && (
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      )}
    </div>
  );
}
