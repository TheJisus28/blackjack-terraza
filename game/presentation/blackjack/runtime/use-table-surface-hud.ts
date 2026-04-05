"use client";

import { useEffect, useRef, useState } from "react";
import {
  type GamePhase,
  type TableCardLayout,
  maxDealGlobalIndex,
} from "@/game/simulation/blackjack";
import {
  dealWaveChromeDelayMs,
  nextFeedbackMaxGlobal,
} from "@/game/presentation/blackjack/fx/deal-wave-transitions";
import {
  DEAL_WAVE_NODE,
  type TableHudVariant,
  multiplayerOverlayUnlocked,
  shouldEnterDealWaveTransition,
} from "@/game/presentation/blackjack/fx/table-surface-fsm";

export interface TableSurfaceHudSnapshot {
  hudInteractive: boolean;
}

/**
 * Presentation FSM: simulation phase commits drive a timed deal-wave sub-state, then HUD gating.
 */
export function useTableSurfaceHud(
  variant: TableHudVariant,
  layout: TableCardLayout,
  simPhase: GamePhase,
  layoutSig: string,
): TableSurfaceHudSnapshot {
  const [dealWaveNode, setDealWaveNode] = useState<
    (typeof DEAL_WAVE_NODE)[keyof typeof DEAL_WAVE_NODE]
  >(DEAL_WAVE_NODE.IDLE);
  const [mpOverlay, setMpOverlay] = useState(false);

  const prevSimPhaseRef = useRef<GamePhase | undefined>(undefined);
  const prevFeedbackMaxGRef = useRef(-1);

  useEffect(() => {
    const prev = prevSimPhaseRef.current;
    prevSimPhaseRef.current = simPhase;

    if (shouldEnterDealWaveTransition(prev, simPhase)) {
      setDealWaveNode(DEAL_WAVE_NODE.TIMED_WAVE);
      const delay = dealWaveChromeDelayMs(layout, prevFeedbackMaxGRef.current);
      const timer = window.setTimeout(() => {
        setDealWaveNode(DEAL_WAVE_NODE.IDLE);
        if (variant === "multiplayer") {
          setMpOverlay(true);
        }
      }, delay);
      prevFeedbackMaxGRef.current = maxDealGlobalIndex(layout);
      return () => window.clearTimeout(timer);
    }

    setDealWaveNode(DEAL_WAVE_NODE.IDLE);
    if (variant === "multiplayer") {
      setMpOverlay(multiplayerOverlayUnlocked(simPhase, prev));
    }

    const nextMax = nextFeedbackMaxGlobal(layout, simPhase);
    if (nextMax !== null) prevFeedbackMaxGRef.current = nextMax;
  }, [variant, simPhase, layout, layoutSig]);

  const hudInteractive =
    !(
      dealWaveNode === DEAL_WAVE_NODE.TIMED_WAVE ||
      (variant === "multiplayer" && !mpOverlay)
    );

  return { hudInteractive };
}
