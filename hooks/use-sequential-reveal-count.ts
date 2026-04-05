"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cuántas cartas cuentan para el total mostrado, alineado con el fin de cada animación.
 * `revealAtMsForLocalIndex(i)` = ms hasta que la carta local `i` ha terminado de repartirse.
 */
export function useSequentialRevealCount(
  cardCount: number,
  revealAtMsForLocalIndex: (localCardIndex: number) => number,
): number {
  const [revealed, setRevealed] = useState(0);
  const revealedRef = useRef(0);
  revealedRef.current = revealed;
  const revealRef = useRef(revealAtMsForLocalIndex);
  revealRef.current = revealAtMsForLocalIndex;

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
        const ms = revealRef.current(localIdx);
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
