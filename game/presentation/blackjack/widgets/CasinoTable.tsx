"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { TableCardLayout } from "@/game/simulation/blackjack/deal-sequence";
import { DealAnimationProvider } from "./DealAnimationContext";

interface CasinoTableProps {
  dealerSlot: ReactNode;
  playerSlots: ReactNode;
  controlsSlot: ReactNode;
  messageSlot?: ReactNode;
  headerSlot: ReactNode;
  /** Current layout for relative card delays (hits / dealer draws) */
  tableLayout?: TableCardLayout;
}

export function CasinoTable({
  dealerSlot,
  playerSlots,
  controlsSlot,
  messageSlot,
  headerSlot,
  tableLayout,
}: CasinoTableProps) {
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsLg(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsLg(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  const tableBody = (
    <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-2 sm:px-4 py-2 sm:py-3"
        style={{ padding: isLg ? "12px 20px" : undefined }}
      >
        {/* Wood border */}
        <div
          className="w-full rounded-t-[48%] rounded-b-[6%] bg-gradient-to-b from-[#6b4423] via-[#7a4f2b] to-[#4a2e14] shadow-[0_8px_40px_rgba(0,0,0,0.6)]"
          style={{
            maxWidth: isLg ? "90vw" : "900px",
            padding: isLg ? "10px" : "5px",
          }}
        >
          {/* Felt surface */}
          <div className="relative w-full rounded-t-[48%] rounded-b-[6%] bg-gradient-to-b from-[#1a6b3c] via-[#1e7a42] to-[#176638] overflow-hidden">
            {/* Felt texture overlay */}
            <div className="absolute inset-0 opacity-[0.06] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%224%22%20height%3D%224%22%3E%3Crect%20width%3D%221%22%20height%3D%221%22%20fill%3D%22%23000%22%2F%3E%3C%2Fsvg%3E')] pointer-events-none" />

            {/* Inner shadow */}
            <div className="absolute inset-0 rounded-t-[48%] rounded-b-[6%] shadow-[inset_0_4px_30px_rgba(0,0,0,0.35)] pointer-events-none z-[1]" />

            {/* Decorative inner arc */}
            <div className="absolute inset-[10%] rounded-t-[48%] rounded-b-[6%] border border-yellow-400/[0.07] pointer-events-none" />

            {/* Content - flex column layout */}
            <div
              className="relative z-[2] flex flex-col items-center px-2 sm:px-6"
              style={{ minHeight: isLg ? "60vh" : "340px", paddingInline: isLg ? "40px" : undefined }}
            >
              {/* Dealer - top area with extra top padding for the rounded shape */}
              <div className="pt-[15%] sm:pt-[12%] pb-2 sm:pb-3 flex-shrink-0" style={{ paddingTop: isLg ? "8%" : undefined, paddingBottom: isLg ? "16px" : undefined }}>
                {dealerSlot}
              </div>

              {/* Texto impreso en el tapete (legible sobre el verde) */}
              <div className="pointer-events-none select-none flex flex-col items-center gap-0.5 sm:gap-1 flex-shrink-0 text-center px-2">
                <p
                  className="font-bold uppercase tracking-[0.32em] text-amber-50 text-[10px] sm:text-xs whitespace-nowrap"
                  style={{
                    textShadow:
                      "0 1px 2px rgba(0,0,0,0.95), 0 0 20px rgba(0,0,0,0.45)",
                    fontSize: isLg ? "13px" : undefined,
                  }}
                >
                  Dealer
                </p>
                <p
                  className="font-bold uppercase tracking-[0.22em] text-amber-100 text-[9px] sm:text-[11px] whitespace-nowrap"
                  style={{
                    textShadow:
                      "0 1px 2px rgba(0,0,0,0.95), 0 0 18px rgba(0,0,0,0.4)",
                    fontSize: isLg ? "14px" : undefined,
                  }}
                >
                  Blackjack pays 3 to 2
                </p>
                <p
                  className="font-medium text-amber-50/85 not-italic text-[8px] sm:text-[10px] tracking-[0.12em]"
                  style={{
                    textShadow: "0 1px 2px rgba(0,0,0,0.9)",
                    fontSize: isLg ? "11px" : undefined,
                  }}
                >
                  by TheJisus28
                </p>
              </div>

              {/* Message */}
              {messageSlot && (
                <div className="py-2 w-full flex-shrink-0">
                  {messageSlot}
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1 min-h-2" />

              {/* Player seats */}
              <div className="w-full pb-4 sm:pb-5 flex-shrink-0" style={{ paddingBottom: isLg ? "32px" : undefined }}>
                {playerSlots}
              </div>
            </div>
          </div>
        </div>
      </div>
  );

  return (
    <div className="relative flex flex-col min-h-[100dvh] bg-[#0f0f1a] overflow-hidden">
      {headerSlot}

      {tableLayout ? (
        <DealAnimationProvider layout={tableLayout}>{tableBody}</DealAnimationProvider>
      ) : (
        tableBody
      )}

      {/* Controls below table */}
      <div className="relative z-10 w-full max-w-lg mx-auto px-4 pb-5 sm:pb-6 flex-shrink-0" style={{ maxWidth: isLg ? "600px" : undefined, paddingBottom: isLg ? "24px" : undefined }}>
        {controlsSlot}
      </div>
    </div>
  );
}
