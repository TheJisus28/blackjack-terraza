"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  assignGlobalDealIndices,
  dealLayoutSignature,
  feedbackWaveDurationMs,
  maxGlobalDealIndex,
  totalCardsOnTable,
  type TableCardLayout,
} from "@/game/simulation/blackjack";
import {
  CARD_DEAL_DURATION_MS,
  CARD_SEQUENTIAL_STEP_MS,
} from "@/game/simulation/blackjack";

export type DealAnimationApi = {
  /** Deal animation start delay (ms) vs the last settled “frame” */
  getDealDelayMs: (globalDealIndex: number) => number;
  /** When the hand total that includes this card should appear (ms from current layout mount) */
  getRevealDeadlineMs: (globalDealIndex: number) => number;
};

const DealAnimationContext = createContext<DealAnimationApi | null>(null);

export function useDealAnimation(): DealAnimationApi | null {
  return useContext(DealAnimationContext);
}

/**
 * Avoids `globalIndex * STEP` per card (late hits would delay for seconds). New batches are timed
 * relative to the last settled `prevMaxGlobal` instead.
 */
export function DealAnimationProvider({
  layout,
  children,
}: {
  layout: TableCardLayout;
  children: ReactNode;
}) {
  const layoutSig = dealLayoutSignature(layout);
  const maxG = useMemo(() => {
    const map = assignGlobalDealIndices(layout);
    return maxGlobalDealIndex(map);
  }, [layoutSig]);
  const total = useMemo(() => totalCardsOnTable(layout), [layoutSig]);

  const prevMaxGlobalRef = useRef(-1);
  const waveCommitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const getDealDelayMs = useCallback((globalDealIndex: number) => {
    const prev = prevMaxGlobalRef.current;
    // Empty table → full deal: absolute timeline until the wave ends.
    // If we set prev=maxG on first layout, a re-render would give delay 0 for every card.
    if (prev < 0) {
      return globalDealIndex * CARD_SEQUENTIAL_STEP_MS;
    }
    if (globalDealIndex <= prev) return 0;
    return (globalDealIndex - prev - 1) * CARD_SEQUENTIAL_STEP_MS;
  }, []);

  const getRevealDeadlineMs = useCallback(
    (globalDealIndex: number) =>
      getDealDelayMs(globalDealIndex) + CARD_DEAL_DURATION_MS,
    [getDealDelayMs],
  );

  const value = useMemo(
    () => ({ getDealDelayMs, getRevealDeadlineMs }),
    [getDealDelayMs, getRevealDeadlineMs],
  );

  useLayoutEffect(() => {
    const clearScheduled = () => {
      if (waveCommitTimeoutRef.current !== null) {
        clearTimeout(waveCommitTimeoutRef.current);
        waveCommitTimeoutRef.current = null;
      }
    };
    clearScheduled();

    if (maxG < 0 || total === 0) {
      prevMaxGlobalRef.current = -1;
      return clearScheduled;
    }

    const oldPrev = prevMaxGlobalRef.current;

    // Same max global (e.g. only faceUp changed): commit immediately.
    if (maxG <= oldPrev) {
      prevMaxGlobalRef.current = maxG;
      return clearScheduled;
    }

    // Any new batch (initial deal, hit, dealer multi-draw in one tick): do not commit prevMax
    // until the wave ends, or a re-render sets delay 0 on all cards and CSS animations desync.
    const ms = feedbackWaveDurationMs(layout, oldPrev);
    waveCommitTimeoutRef.current = setTimeout(() => {
      waveCommitTimeoutRef.current = null;
      prevMaxGlobalRef.current = maxG;
    }, ms > 0 ? ms : 0);
    return clearScheduled;
    // `layout` read from closure only; omit object identity (parent may recreate each render).
  }, [layoutSig, maxG, total]);

  return (
    <DealAnimationContext.Provider value={value}>
      {children}
    </DealAnimationContext.Provider>
  );
}
