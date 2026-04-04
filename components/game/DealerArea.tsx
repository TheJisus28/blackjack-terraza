"use client";

import type { GameState } from "@/lib/blackjack/types";
import { getHandValue } from "@/lib/blackjack/hand";
import { Card } from "./Card";

interface DealerAreaProps {
  gameState: GameState;
}

export function DealerArea({ gameState }: DealerAreaProps) {
  const { dealer, phase } = gameState;
  const showFullValue = phase === "resolving" || phase === "finished";
  const visibleCards = dealer.cards.filter((c) => c.faceUp);
  const value = showFullValue
    ? getHandValue(dealer.cards)
    : getHandValue(visibleCards);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-emerald-300 uppercase tracking-widest">
          Dealer
        </span>
        {dealer.cards.length > 0 && (
          <span className="text-lg font-bold text-white tabular-nums">
            {value}
            {dealer.status === "busted" && (
              <span className="text-red-400 text-sm ml-1">BUST</span>
            )}
          </span>
        )}
      </div>

      <div className="flex -space-x-6">
        {dealer.cards.map((card, i) => (
          <Card key={`dealer-${i}`} card={card} index={i} />
        ))}
      </div>
    </div>
  );
}
