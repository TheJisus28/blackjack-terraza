"use client";

import type { GameState } from "@/lib/blackjack/types";
import { getHandValue } from "@/lib/blackjack/hand";
import { useRevealedCardCount } from "@/hooks/use-revealed-card-count";
import { Card } from "./Card";

interface DealerAreaProps {
  gameState: GameState;
}

export function DealerArea({ gameState }: DealerAreaProps) {
  const { dealer, phase } = gameState;
  const showFullValue = phase === "resolving" || phase === "finished";
  const revealedCount = useRevealedCardCount(dealer.cards.length);
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
          <Card key={`dealer-${i}`} card={card} index={i} />
        ))}
      </div>
    </div>
  );
}
