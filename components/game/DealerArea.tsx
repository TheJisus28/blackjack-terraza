"use client";

import { useMemo, useCallback } from "react";
import type { GameState } from "@/lib/blackjack/types";
import { getHandValue } from "@/lib/blackjack/hand";
import {
  assignGlobalDealIndices,
  dealLayoutSignature,
  dealerCardKey,
} from "@/lib/blackjack/deal-sequence";
import {
  CARD_DEAL_DURATION_MS,
  CARD_SEQUENTIAL_STEP_MS,
  CARD_TOTAL_REVEAL_BUFFER_MS,
} from "@/lib/blackjack/constants";
import { useSequentialRevealCount } from "@/hooks/use-sequential-reveal-count";
import { useDealAnimation } from "./DealAnimationContext";
import { Card } from "./Card";

type DealerAreaState = Pick<GameState, "dealer" | "players" | "phase">;

interface DealerAreaProps {
  gameState: DealerAreaState;
}

export function DealerArea({ gameState }: DealerAreaProps) {
  const dealAnim = useDealAnimation();
  const { dealer, phase, players } = gameState;
  const showFullValue = phase === "resolving" || phase === "finished";

  const tableLayout = { players, dealer };
  const layoutSig = dealLayoutSignature(tableLayout);
  const globalIndexByLocal = useMemo(() => {
    const map = assignGlobalDealIndices(tableLayout);
    const n = dealer.cards.length;
    const out: number[] = [];
    for (let ci = 0; ci < n; ci++) {
      const key = dealerCardKey(ci);
      let g = map.get(key);
      if (g === undefined) {
        g = ci === 0 ? 0 : out[ci - 1]! + 1;
      } else if (ci > 0 && g <= out[ci - 1]!) {
        g = out[ci - 1]! + 1;
      }
      out.push(g);
    }
    return out;
  }, [layoutSig, dealer.cards.length]);

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
    dealer.cards.length,
    revealAtMsForLocalIndex,
  );
  const slice = dealer.cards.slice(0, revealedCount);
  const value = showFullValue
    ? getHandValue(slice.map((c) => ({ ...c, faceUp: true })))
    : getHandValue(slice.filter((c) => c.faceUp));

  return (
    <div className="flex flex-col items-center gap-3" aria-label="Mano del crupier">
      <div className="flex items-center justify-center gap-2 min-h-[1.75rem]">
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
        {dealer.cards.map((card, i) => {
          const g = globalFor(i);
          const dealDelayMs = dealAnim
            ? dealAnim.getDealDelayMs(g)
            : g * CARD_SEQUENTIAL_STEP_MS;
          return (
            <Card
              key={`dealer-${i}`}
              card={card}
              index={i}
              dealDelayMs={dealDelayMs}
            />
          );
        })}
      </div>
    </div>
  );
}
