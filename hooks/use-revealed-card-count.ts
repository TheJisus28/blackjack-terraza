"use client";

import { useEffect, useRef, useState } from "react";
import {
  CARD_ANIM_DELAY_PER_CARD_MS,
  CARD_DEAL_DURATION_MS,
} from "@/lib/blackjack/constants";

/**
 * Cuántas cartas (desde el inicio del array) entran en el total mostrado.
 * Cada carta nueva suma su valor cuando termina su animación de reparto.
 * Si llegan varias cartas en un solo update (p. ej. crupier robando de golpe),
 * se programa un tick por carta para no mostrar el total final antes de tiempo.
 */
export function useRevealedCardCount(cardCount: number): number {
  const [revealed, setRevealed] = useState(0);
  const revealedRef = useRef(0);
  revealedRef.current = revealed;

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
        const cardIndex = k - 1;
        const ms =
          cardIndex * CARD_ANIM_DELAY_PER_CARD_MS + CARD_DEAL_DURATION_MS;
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
