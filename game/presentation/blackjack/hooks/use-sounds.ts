"use client";

import { useEffect, useRef } from "react";
import { sounds } from "@/shared/audio/sounds";
import type { GamePhase } from "@/game/simulation/blackjack/types";
import { PHASE } from "@/game/simulation/blackjack/game-phase";
import {
  assignGlobalDealIndices,
  dealLayoutSignature,
  feedbackWaveDurationMs,
  maxDealGlobalIndex,
  maxGlobalDealIndex,
  totalCardsOnTable,
  type TableCardLayout,
} from "@/game/simulation/blackjack/deal-sequence";
import {
  isInitialDealOrInsuranceReveal,
  isRoundEndReveal,
} from "@/game/presentation/blackjack/lib/deal-wave-transitions";
import { CARD_ANIM_DELAY_PER_CARD_MS, CARD_SEQUENTIAL_STEP_MS } from "@/game/simulation/blackjack/constants";

interface UseSoundsOptions {
  phase: GamePhase;
  dealerCardCount: number;
  playerCardCount: number;
  resultOutcome?: string | null;
  isMyTurn?: boolean;
  /** Players + dealer layout so audio lines up with the global deal queue */
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
  /** Phase before `finished` — `prevPhaseRef` is updated too early for result SFX timing. */
  const phaseBeforeFinishRef = useRef<GamePhase>(phase);
  const prevPlayerCards = useRef(playerCardCount);
  const prevDealerCards = useRef(dealerCardCount);
  const lastDealerLenForDealRef = useRef(dealerCardCount);
  /** Aligns win/lose SFX with the card wave (same basis as feedbackWaveDurationMs). */
  const prevSoundFeedbackMaxGRef = useRef(-1);

  const tableSeqSig = tableForSequence
    ? dealLayoutSignature(tableForSequence)
    : "";

  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    const initialDealWave = isInitialDealOrInsuranceReveal(prevPhase, phase);
    const roundEndDealWave = isRoundEndReveal(prevPhase, phase);

    if (tableForSequence && tableSeqSig) {
      if (initialDealWave) {
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

      if (roundEndDealWave) {
        const prevD = lastDealerLenForDealRef.current;
        const nowD = tableForSequence.dealer.cards.length;
        const timers: number[] = [];
        let batchIndex = 0;
        for (let ci = prevD; ci < nowD; ci++) {
          timers.push(
            window.setTimeout(
              () => sounds.cardDeal(),
              batchIndex * CARD_SEQUENTIAL_STEP_MS,
            ),
          );
          batchIndex++;
        }
        lastDealerLenForDealRef.current = nowD;
        return () => {
          for (const t of timers) window.clearTimeout(t);
        };
      }
    } else {
      if (initialDealWave) {
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

      if (roundEndDealWave && dealerCardCount > 0) {
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

    if (phase === PHASE.BETTING || phase === PHASE.WAITING) {
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
    if (phase !== PHASE.PLAYING) {
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
    if (!tableForSequence) return;
    const total = totalCardsOnTable(tableForSequence);
    if (total === 0) {
      prevSoundFeedbackMaxGRef.current = -1;
      return;
    }
    if (phase === PHASE.FINISHED) return;
    prevSoundFeedbackMaxGRef.current = maxDealGlobalIndex(tableForSequence);
  }, [tableSeqSig, phase, tableForSequence]);

  useEffect(() => {
    if (phase !== PHASE.FINISHED || !resultOutcome) {
      if (phase !== PHASE.FINISHED) {
        phaseBeforeFinishRef.current = phase;
      }
      return;
    }

    const cameFrom = phaseBeforeFinishRef.current;
    if (cameFrom === PHASE.FINISHED) return;

    phaseBeforeFinishRef.current = phase;

    const delay = tableForSequence
      ? feedbackWaveDurationMs(
          tableForSequence,
          prevSoundFeedbackMaxGRef.current,
        ) + 340
      : dealerCardCount * CARD_ANIM_DELAY_PER_CARD_MS + 340;

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
    if (phase === PHASE.PLAYING && isMyTurn) {
      sounds.turn();
    }
  }, [phase, isMyTurn]);
}
