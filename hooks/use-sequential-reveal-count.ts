"use client";

import { useEffect, useRef, useState } from "react";
import {
  CARD_DEAL_DURATION_MS,
  CARD_SEQUENTIAL_STEP_MS,
} from "@/lib/blackjack/constants";

/**
 * Cuántas cartas cuentan para el total mostrado, alineado con el fin de cada animación
 * en la cola global de la mesa (ver assignGlobalDealIndices).
 */
export function useSequentialRevealCount(
  cardCount: number,
  resolveGlobalIndex: (localCardIndex: number) => number,
): number {
  const [revealed, setRevealed] = useState(0);
  const revealedRef = useRef(0);
  revealedRef.current = revealed;
  const resolveRef = useRef(resolveGlobalIndex);
  resolveRef.current = resolveGlobalIndex;

  useEffect(() => {
    const n = cardCount;
    if (n === 0) {
      setRevealed(0);
      return;
    }
    const prev = revealedRef.current;
    if (n < prev) {
      setRevealed(n);
      return;
    }
    if (n > prev) {
      const timers: number[] = [];
      for (let k = prev + 1; k <= n; k++) {
        const localIdx = k - 1;
        const g = resolveRef.current(localIdx);
        const ms = g * CARD_SEQUENTIAL_STEP_MS + CARD_DEAL_DURATION_MS;
        timers.push(
          window.setTimeout(() => {
            setRevealed(k);
          }, ms),
        );
      }
      return () => {
        for (const t of timers) window.clearTimeout(t);
      };
    }
  }, [cardCount]);

  return revealed;
}
