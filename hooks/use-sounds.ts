"use client";

import { useEffect, useRef } from "react";
import { sounds } from "@/lib/sounds";
import type { GamePhase } from "@/lib/blackjack/types";
import {
  assignGlobalDealIndices,
  dealerCardKey,
  maxDealAnimationDurationMs,
  maxGlobalDealIndex,
  dealLayoutSignature,
  type TableCardLayout,
} from "@/lib/blackjack/deal-sequence";
import { CARD_ANIM_DELAY_PER_CARD_MS, CARD_SEQUENTIAL_STEP_MS } from "@/lib/blackjack/constants";

interface UseSoundsOptions {
  phase: GamePhase;
  dealerCardCount: number;
  playerCardCount: number;
  resultOutcome?: string | null;
  isMyTurn?: boolean;
  /** Jugadores + crupier para alinear pops con la cola global de cartas */
  tableForSequence?: TableCardLayout;
}

export function useSounds({
  phase,
  dealerCardCount,
  playerCardCount,
  resultOutcome,
  isMyTurn,
  tableForSequence,
}: UseSoundsOptions) {
  const prevPhaseRef = useRef(phase);
  /** Fase antes de entrar en `finished` (el otro efecto pisa `prevPhaseRef` demasiado pronto) */
  const phaseBeforeFinishRef = useRef<GamePhase>(phase);
  const prevPlayerCards = useRef(playerCardCount);
  const prevDealerCards = useRef(dealerCardCount);
  const lastDealerLenForDealRef = useRef(dealerCardCount);

  const tableSeqSig = tableForSequence
    ? dealLayoutSignature(tableForSequence)
    : "";

  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    const isInitialDeal =
      prevPhase === "betting" &&
      (phase === "playing" || phase === "finished" || phase === "insurance");
    const isDealerReveal =
      (prevPhase === "playing" || prevPhase === "insurance") &&
      phase === "finished";

    if (tableForSequence && tableSeqSig) {
      if (isInitialDeal) {
        const map = assignGlobalDealIndices(tableForSequence);
        const maxG = maxGlobalDealIndex(map);
        const timers: number[] = [];
        for (let g = 0; g <= maxG; g++) {
          timers.push(
            window.setTimeout(
              () => sounds.cardDeal(),
              g * CARD_SEQUENTIAL_STEP_MS,
            ),
          );
        }
        lastDealerLenForDealRef.current = tableForSequence.dealer.cards.length;
        return () => {
          for (const t of timers) window.clearTimeout(t);
        };
      }

      if (isDealerReveal) {
        const prevD = lastDealerLenForDealRef.current;
        const nowD = tableForSequence.dealer.cards.length;
        const map = assignGlobalDealIndices(tableForSequence);
        const timers: number[] = [];
        for (let ci = prevD; ci < nowD; ci++) {
          const g = map.get(dealerCardKey(ci)) ?? 0;
          timers.push(
            window.setTimeout(
              () => sounds.cardDeal(),
              g * CARD_SEQUENTIAL_STEP_MS,
            ),
          );
        }
        lastDealerLenForDealRef.current = nowD;
        return () => {
          for (const t of timers) window.clearTimeout(t);
        };
      }
    } else {
      if (isInitialDeal) {
        const totalCards = playerCardCount + dealerCardCount;
        const timers: number[] = [];
        for (let i = 0; i < totalCards; i++) {
          timers.push(
            window.setTimeout(
              () => sounds.cardDeal(),
              i * CARD_ANIM_DELAY_PER_CARD_MS,
            ),
          );
        }
        lastDealerLenForDealRef.current = dealerCardCount;
        return () => {
          for (const t of timers) window.clearTimeout(t);
        };
      }

      if (isDealerReveal && dealerCardCount > 0) {
        const timers: number[] = [];
        for (let i = 0; i < dealerCardCount; i++) {
          timers.push(
            window.setTimeout(
              () => sounds.cardDeal(),
              i * CARD_ANIM_DELAY_PER_CARD_MS,
            ),
          );
        }
        lastDealerLenForDealRef.current = dealerCardCount;
        return () => {
          for (const t of timers) window.clearTimeout(t);
        };
      }
    }

    if (phase === "betting" || phase === "waiting") {
      lastDealerLenForDealRef.current = 0;
    } else {
      lastDealerLenForDealRef.current = dealerCardCount;
    }
  }, [
    phase,
    dealerCardCount,
    playerCardCount,
    tableForSequence,
    tableSeqSig,
  ]);

  useEffect(() => {
    if (phase !== "playing") {
      prevPlayerCards.current = playerCardCount;
      prevDealerCards.current = dealerCardCount;
      return;
    }
    if (playerCardCount > prevPlayerCards.current) {
      sounds.cardDeal();
    }
    prevPlayerCards.current = playerCardCount;
    prevDealerCards.current = dealerCardCount;
  }, [phase, playerCardCount, dealerCardCount]);

  useEffect(() => {
    if (phase !== "finished" || !resultOutcome) {
      if (phase !== "finished") {
        phaseBeforeFinishRef.current = phase;
      }
      return;
    }

    const cameFrom = phaseBeforeFinishRef.current;
    if (cameFrom === "finished") return;

    phaseBeforeFinishRef.current = phase;

    const delay = tableForSequence
      ? maxDealAnimationDurationMs(tableForSequence) + 400
      : dealerCardCount * CARD_ANIM_DELAY_PER_CARD_MS + 400;

    const timer = setTimeout(() => {
      switch (resultOutcome) {
        case "blackjack":
          sounds.blackjack();
          break;
        case "win":
          sounds.win();
          break;
        case "lose":
          sounds.lose();
          break;
        case "push":
          sounds.push();
          break;
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [phase, resultOutcome, dealerCardCount, tableForSequence, tableSeqSig]);

  useEffect(() => {
    if (phase === "playing" && isMyTurn) {
      sounds.turn();
    }
  }, [phase, isMyTurn]);
}
