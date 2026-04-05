"use client";

import { useEffect, useRef, useState } from "react";

/**
 * How many cards count toward the displayed hand total, aligned with each deal animation end.
 * `revealAtMsForLocalIndex(i)` = ms until local card `i` has finished dealing.
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
        let ms = 0;
        for (let j = 0; j < k; j++) {
          ms = Math.max(ms, revealRef.current(j));
        }
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
