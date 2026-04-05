"use client";

import { useEffect, useRef, useState } from "react";
import type { GamePhase } from "@/game/simulation/blackjack/types";
import {
  maxDealGlobalIndex,
  type TableCardLayout,
} from "@/game/simulation/blackjack/deal-sequence";
import {
  dealWaveChromeDelayMs,
  nextFeedbackMaxGlobal,
} from "@/game/presentation/blackjack/lib/deal-wave-transitions";
import {
  DEAL_WAVE_NODE,
  type DealWavePresentationNode,
  type TableHudVariant,
  TABLE_SURFACE_VISUAL,
  type TableSurfaceVisualState,
  multiplayerOverlayUnlocked,
  shouldEnterDealWaveTransition,
} from "@/game/presentation/blackjack/lib/table-surface-fsm";

export interface TableSurfaceHudSnapshot {
  visual: TableSurfaceVisualState;
  hudInteractive: boolean;
  dealWaveNode: DealWavePresentationNode;
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
  const [dealWaveNode, setDealWaveNode] = useState<DealWavePresentationNode>(
    DEAL_WAVE_NODE.IDLE,
  );
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

  const visual: TableSurfaceVisualState =
    dealWaveNode === DEAL_WAVE_NODE.TIMED_WAVE ||
    (variant === "multiplayer" && !mpOverlay)
      ? TABLE_SURFACE_VISUAL.DEAL_WAVE_SUPPRESSED
      : TABLE_SURFACE_VISUAL.HUD_INTERACTIVE;

  const hudInteractive = visual === TABLE_SURFACE_VISUAL.HUD_INTERACTIVE;

  return { visual, hudInteractive, dealWaveNode };
}
