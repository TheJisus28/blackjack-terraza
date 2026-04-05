"use client";

import { useEffect, useRef } from "react";
import { sounds } from "@/lib/sounds";
import type { GamePhase } from "@/lib/blackjack/types";
import { CARD_ANIM_DELAY_PER_CARD_MS } from "@/lib/blackjack/constants";

interface UseSoundsOptions {
  phase: GamePhase;
  dealerCardCount: number;
  playerCardCount: number;
  resultOutcome?: string | null;
  isMyTurn?: boolean;
}

export function useSounds({
  phase,
  dealerCardCount,
  playerCardCount,
  resultOutcome,
  isMyTurn,
}: UseSoundsOptions) {
  const prevPhaseRef = useRef(phase);
  const prevPlayerCards = useRef(playerCardCount);
  const prevDealerCards = useRef(dealerCardCount);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    const isInitialDeal =
      prev === "betting" && (phase === "playing" || phase === "finished");
    const isDealerReveal = prev === "playing" && phase === "finished";

    if (isInitialDeal) {
      const totalCards = playerCardCount + dealerCardCount;
      for (let i = 0; i < totalCards; i++) {
        setTimeout(() => sounds.cardDeal(), i * CARD_ANIM_DELAY_PER_CARD_MS);
      }
    }

    if (isDealerReveal && dealerCardCount > 0) {
      for (let i = 0; i < dealerCardCount; i++) {
        setTimeout(() => sounds.cardDeal(), i * CARD_ANIM_DELAY_PER_CARD_MS);
      }
    }
  }, [phase, dealerCardCount, playerCardCount]);

  // Sound for individual hits during playing phase
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

  // Result sounds
  useEffect(() => {
    if (phase !== "finished" || !resultOutcome) return;
    const prevPhase = prevPhaseRef.current;
    if (prevPhase === "finished") return;

    const totalCards = dealerCardCount;
    const delay = totalCards * CARD_ANIM_DELAY_PER_CARD_MS + 400;

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
  }, [phase, resultOutcome, dealerCardCount]);

  // Turn notification sound
  useEffect(() => {
    if (phase === "playing" && isMyTurn) {
      sounds.turn();
    }
  }, [phase, isMyTurn]);
}
