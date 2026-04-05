"use client";

import type { ReactNode } from "react";

interface CasinoTableProps {
  dealerSlot: ReactNode;
  playerSlots: ReactNode;
  controlsSlot: ReactNode;
  messageSlot?: ReactNode;
  headerSlot: ReactNode;
}

export function CasinoTable({
  dealerSlot,
  playerSlots,
  controlsSlot,
  messageSlot,
  headerSlot,
}: CasinoTableProps) {
  return (
    <div className="relative flex flex-col min-h-[100dvh] bg-[#0f0f1a] overflow-hidden">
      {headerSlot}

      <div className="relative z-10 flex-1 flex flex-col items-center px-2 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6">
        {/* Wood border */}
        <div className="w-full max-w-[900px] lg:max-w-[1100px] xl:max-w-[1200px] rounded-t-[48%] rounded-b-[6%] bg-gradient-to-b from-[#6b4423] via-[#7a4f2b] to-[#4a2e14] p-[5px] sm:p-[7px] lg:p-[9px] shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
          {/* Felt surface */}
          <div className="relative w-full rounded-t-[48%] rounded-b-[6%] bg-gradient-to-b from-[#1a6b3c] via-[#1e7a42] to-[#176638] overflow-hidden">
            {/* Felt texture overlay */}
            <div className="absolute inset-0 opacity-[0.06] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%224%22%20height%3D%224%22%3E%3Crect%20width%3D%221%22%20height%3D%221%22%20fill%3D%22%23000%22%2F%3E%3C%2Fsvg%3E')] pointer-events-none" />

            {/* Inner shadow */}
            <div className="absolute inset-0 rounded-t-[48%] rounded-b-[6%] shadow-[inset_0_4px_30px_rgba(0,0,0,0.35)] pointer-events-none z-[1]" />

            {/* Decorative inner arc */}
            <div className="absolute inset-[10%] rounded-t-[48%] rounded-b-[6%] border border-yellow-400/[0.07] pointer-events-none" />

            {/* Content - flex column layout */}
            <div className="relative z-[2] flex flex-col items-center min-h-[340px] sm:min-h-[400px] lg:min-h-[480px] xl:min-h-[520px] px-2 sm:px-6 lg:px-8">
              {/* Dealer - top area with extra top padding for the rounded shape */}
              <div className="pt-[15%] sm:pt-[12%] lg:pt-[10%] pb-2 sm:pb-3 lg:pb-4 flex-shrink-0">
                {dealerSlot}
              </div>

              {/* "BLACKJACK PAYS 3:2" text */}
              <div className="pointer-events-none select-none flex-shrink-0">
                <p className="text-yellow-500/[0.12] text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.3em] whitespace-nowrap">
                  Blackjack pays 3 to 2
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
              <div className="w-full pb-4 sm:pb-5 lg:pb-6 flex-shrink-0">
                {playerSlots}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls below table */}
      <div className="relative z-10 w-full max-w-lg lg:max-w-xl mx-auto px-4 pb-5 sm:pb-6 lg:pb-8 flex-shrink-0">
        {controlsSlot}
      </div>
    </div>
  );
}
