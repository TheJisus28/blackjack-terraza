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
} from "@/lib/blackjack/deal-sequence";
import {
  CARD_DEAL_DURATION_MS,
  CARD_SEQUENTIAL_STEP_MS,
} from "@/lib/blackjack/constants";

export type DealAnimationApi = {
  /** Retardo del inicio de la animación de reparto (ms) respecto al “último frame” ya asentado */
  getDealDelayMs: (globalDealIndex: number) => number;
  /** Cuándo debe mostrarse el total que incluye esa carta (ms desde el montaje del estado actual) */
  getRevealDeadlineMs: (globalDealIndex: number) => number;
};

const DealAnimationContext = createContext<DealAnimationApi | null>(null);

export function useDealAnimation(): DealAnimationApi | null {
  return useContext(DealAnimationContext);
}

/**
 * Evita usar `globalIndex * STEP` en cada carta: al pedir hit el índice global es alto y la carta
 * tardaba segundos en animarse. Aquí solo se escala el “lote” nuevo desde prevMaxGlobal.
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
    // Reparto desde mesa vacía: línea temporal absoluta hasta que acabe la ola.
    // Si fijáramos prev=maxG en el primer layout, un re-render pondría retraso 0 en todas.
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

    // Misma firma de max global (p. ej. solo cambia faceUp): asentar ya.
    if (maxG <= oldPrev) {
      prevMaxGlobalRef.current = maxG;
      return clearScheduled;
    }

    // Cualquier lote nuevo (reparto inicial, hit, robo múltiple del crupier en un tick):
    // no fijar prevMax hasta que acabe la ola; si no, un re-render pone retraso 0 en todas
    // y las animaciones CSS se reinician o se desincronizan.
    const ms = feedbackWaveDurationMs(layout, oldPrev);
    waveCommitTimeoutRef.current = setTimeout(() => {
      waveCommitTimeoutRef.current = null;
      prevMaxGlobalRef.current = maxG;
    }, ms > 0 ? ms : 0);
    return clearScheduled;
    // `layout` solo por closure; no incluir referencia del objeto (MultiplayerTable recrea cada render).
  }, [layoutSig, maxG, total]);

  return (
    <DealAnimationContext.Provider value={value}>
      {children}
    </DealAnimationContext.Provider>
  );
}
