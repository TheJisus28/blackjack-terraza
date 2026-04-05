"use client";

import { useMemo, useCallback } from "react";
import type { Hand } from "@/game/simulation/blackjack/types";
import { getHandValue } from "@/game/simulation/blackjack/hand";
import {
  dealLayoutSignature,
  playerCardKey,
  type TableCardLayout,
} from "@/game/simulation/blackjack/deal-sequence";
import { stableGlobalIndicesForKeys } from "@/game/presentation/blackjack/lib/stable-global-deal-indices";
import {
  CARD_DEAL_DURATION_MS,
  CARD_SEQUENTIAL_STEP_MS,
  CARD_TOTAL_REVEAL_BUFFER_MS,
} from "@/game/simulation/blackjack/constants";
import { useSequentialRevealCount } from "@/shared/hooks/use-sequential-reveal-count";
import { useDealAnimation } from "./DealAnimationContext";
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
  const dealAnim = useDealAnimation();
  const layoutSig = dealLayoutSignature(tableLayout);
  const cardKeys = useMemo(
    () =>
      Array.from({ length: hand.cards.length }, (_, ci) =>
        playerCardKey(playerIndex, handIndex, ci),
      ),
    [hand.cards.length, playerIndex, handIndex],
  );
  const globalIndexByLocal = useMemo(
    () => stableGlobalIndicesForKeys(tableLayout, cardKeys),
    [layoutSig, cardKeys],
  );

  const globalFor = useCallback(
    (ci: number) => globalIndexByLocal[ci] ?? 0,
    [globalIndexByLocal],
  );

  const revealAtMsForLocalIndex = useCallback(
    (ci: number) => {
      const g = globalFor(ci);
      const base = dealAnim
        ? dealAnim.getRevealDeadlineMs(g)
        : g * CARD_SEQUENTIAL_STEP_MS + CARD_DEAL_DURATION_MS;
      return base + CARD_TOTAL_REVEAL_BUFFER_MS;
    },
    [dealAnim, globalFor],
  );

  const revealedCount = useSequentialRevealCount(
    hand.cards.length,
    revealAtMsForLocalIndex,
  );
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
    standing: "STAND",
    surrendered: "SURRENDER",
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
        {hand.cards.map((card, i) => {
          const g = globalFor(i);
          const dealDelayMs = dealAnim
            ? dealAnim.getDealDelayMs(g)
            : g * CARD_SEQUENTIAL_STEP_MS;
          return (
            <Card
              key={`p${playerIndex}-h${handIndex}-${i}-${card.rank}-${card.suit}`}
              card={card}
              index={i}
              dealDelayMs={dealDelayMs}
            />
          );
        })}
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
