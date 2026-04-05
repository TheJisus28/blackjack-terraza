"use client";

import { useMemo, useCallback } from "react";
import type { GameState } from "@/lib/blackjack/types";

type DealerAreaState = Pick<GameState, "dealer" | "players" | "phase">;
import { getHandValue } from "@/lib/blackjack/hand";
import {
  assignGlobalDealIndices,
  dealLayoutSignature,
  dealerCardKey,
} from "@/lib/blackjack/deal-sequence";
import { CARD_SEQUENTIAL_STEP_MS } from "@/lib/blackjack/constants";
import { useSequentialRevealCount } from "@/hooks/use-sequential-reveal-count";
import { Card } from "./Card";

interface DealerAreaProps {
  gameState: DealerAreaState;
}

export function DealerArea({ gameState }: DealerAreaProps) {
  const { dealer, phase, players } = gameState;
  const showFullValue = phase === "resolving" || phase === "finished";

  const tableLayout = { players, dealer };
  const layoutSig = dealLayoutSignature(tableLayout);
  const indexMap = useMemo(
    () => assignGlobalDealIndices(tableLayout),
    [layoutSig],
  );

  const resolveDealerIndex = useCallback(
    (ci: number) => indexMap.get(dealerCardKey(ci)) ?? 0,
    [indexMap],
  );

  const revealedCount = useSequentialRevealCount(dealer.cards.length, resolveDealerIndex);
  const slice = dealer.cards.slice(0, revealedCount);
  const value = showFullValue
    ? getHandValue(slice.map((c) => ({ ...c, faceUp: true })))
    : getHandValue(slice.filter((c) => c.faceUp));

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm lg:text-base font-semibold text-emerald-300 uppercase tracking-widest">
          Dealer
        </span>
        {dealer.cards.length > 0 && revealedCount > 0 && (
          <span
            key={revealedCount}
            className="text-lg lg:text-xl font-bold text-white tabular-nums"
            style={{ animation: "fadeInUp 0.35s ease-out both" }}
          >
            {value}
            {dealer.status === "busted" &&
              revealedCount >= dealer.cards.length && (
              <span className="text-red-400 text-sm ml-1">BUST</span>
            )}
          </span>
        )}
      </div>

      <div className="flex -space-x-6 lg:-space-x-7">
        {dealer.cards.map((card, i) => (
          <Card
            key={`dealer-${i}`}
            card={card}
            index={i}
            dealDelayMs={(indexMap.get(dealerCardKey(i)) ?? 0) * CARD_SEQUENTIAL_STEP_MS}
          />
        ))}
      </div>
    </div>
  );
}
