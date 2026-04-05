"use client";

import { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import type { PlayerAction } from "@/game/simulation/blackjack/types";
import { PHASE } from "@/game/simulation/blackjack/game-phase";
import { useGame } from "@/game/presentation/blackjack/hooks/use-game";
import { useTableSurfaceHud } from "@/game/presentation/blackjack/hooks/use-table-surface-hud";
import { useBlackjackPlayingHotkeys } from "@/game/presentation/blackjack/hooks/use-blackjack-playing-hotkeys";
import { useInsuranceCountdown } from "@/game/presentation/blackjack/hooks/use-insurance-countdown";
import { useSounds } from "@/game/presentation/blackjack/hooks/use-sounds";
import { CasinoTable } from "@/game/presentation/blackjack/widgets/CasinoTable";
import { DealerArea } from "@/game/presentation/blackjack/widgets/DealerArea";
import { PlayerSeat, SeatsArc } from "@/game/presentation/blackjack/widgets/PlayerSeat";
import { ActionBar } from "@/game/presentation/blackjack/widgets/ActionBar";
import { BettingControls } from "@/game/presentation/blackjack/widgets/BettingControls";
import { InsuranceControls } from "@/game/presentation/blackjack/widgets/InsuranceControls";
import { dealLayoutSignature } from "@/game/simulation/blackjack/deal-sequence";
import { sounds } from "@/shared/audio/sounds";

export function GameTable() {
  const {
    gameState,
    player,
    lastResults,
    bet,
    action,
    newRound,
    insuranceAccept,
    insuranceDecline,
    resetGame,
  } = useGame("Player");

  const layoutSig = dealLayoutSignature({
    players: gameState.players,
    dealer: gameState.dealer,
  });
  const tableLayoutSlice = useMemo(
    () => ({ players: gameState.players, dealer: gameState.dealer }),
    [layoutSig],
  );

  const { hudInteractive } = useTableSurfaceHud(
    "solo",
    tableLayoutSlice,
    gameState.phase,
    layoutSig,
  );

  const insuranceCountdown = useInsuranceCountdown(
    gameState.phase,
    gameState.insuranceStartedAt,
  );

  const stableAction = useCallback((a: PlayerAction) => action(a), [action]);

  useBlackjackPlayingHotkeys(gameState.phase, true, stableAction);

  useEffect(() => {
    sounds.preloadAll();
  }, []);

  const resultOutcome = lastResults[0]?.outcome;

  const totalPlayerCards =
    player?.hands.reduce((sum, h) => sum + h.cards.length, 0) ?? 0;

  useSounds({
    phase: gameState.phase,
    dealerCardCount: gameState.dealer.cards.length,
    playerCardCount: totalPlayerCards,
    resultOutcome,
    isMyTurn: gameState.phase === PHASE.PLAYING,
    tableForSequence: tableLayoutSlice,
  });

  const header = (
    <header className="relative z-10 w-full flex items-center justify-between px-4 sm:px-6 py-3 bg-black/40 backdrop-blur-sm border-b border-white/5">
      <Link
        href="/"
        className="flex items-center gap-2 text-lg font-bold text-white tracking-tight hover:opacity-80 transition-opacity"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4 text-white/50"
        >
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
            clipRule="evenodd"
          />
        </svg>
        Blackjack <span className="text-emerald-400">Terraza</span>
      </Link>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-yellow-400" />
          <span className="text-sm font-semibold text-yellow-300 tabular-nums">
            ${player?.chips ?? 0}
          </span>
        </div>
        <button
          type="button"
          onClick={resetGame}
          className="text-xs text-white/50 hover:text-white/80 transition-colors cursor-pointer"
        >
          Reiniciar
        </button>
      </div>
    </header>
  );

  const dealer = <DealerArea gameState={gameState} />;

  const shouldShowMessage = hudInteractive && !!gameState.message;

  const message =
    shouldShowMessage && gameState.message ? (
      <p
        className={`text-center font-bold text-sm sm:text-lg px-4 py-1.5 rounded-full w-fit mx-auto
        ${resultOutcome === "blackjack" ? "text-yellow-300 bg-yellow-500/15 border border-yellow-500/20" : ""}
        ${resultOutcome === "win" ? "text-emerald-300 bg-emerald-500/15 border border-emerald-500/20" : ""}
        ${resultOutcome === "lose" ? "text-red-300 bg-red-500/15 border border-red-500/20" : ""}
        ${resultOutcome === "push" ? "text-blue-300 bg-blue-500/15 border border-blue-500/20" : ""}
        ${!resultOutcome ? "text-white/80" : ""}
      `}
        style={{
          animation: "resultPop 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      >
        {gameState.message}
      </p>
    ) : undefined;

  const playerSeats = player ? (
    <SeatsArc count={1}>
      {[
        <PlayerSeat
          key={player.id}
          player={player}
          playerIndex={0}
          tableLayout={tableLayoutSlice}
          isCurrentTurn={
            gameState.phase === PHASE.PLAYING ||
            gameState.phase === PHASE.INSURANCE
          }
          isMe
        />,
      ]}
    </SeatsArc>
  ) : null;

  const controls = (
    <>
      {gameState.phase === PHASE.BETTING && player && (
        <BettingControls
          minBet={gameState.minBet}
          maxBet={gameState.maxBet}
          chips={player.chips}
          onBet={(amount) => {
            sounds.chipPlace();
            bet(amount);
          }}
        />
      )}

      {gameState.phase === PHASE.INSURANCE &&
        hudInteractive &&
        player &&
        player.hands[0]?.bet > 0 && (
          <InsuranceControls
            maxInsurance={Math.floor(player.hands[0].bet / 2)}
            chips={player.chips}
            onConfirm={insuranceAccept}
            onDecline={insuranceDecline}
            countdownSec={insuranceCountdown}
          />
        )}

      {gameState.phase === PHASE.PLAYING && hudInteractive && (
        <ActionBar gameState={gameState} onAction={action} />
      )}

      {gameState.phase === PHASE.FINISHED && hudInteractive && (
        <div
          className="flex flex-col items-center gap-3"
          style={{ animation: "fadeInUp 0.4s ease-out both" }}
        >
          <button
            type="button"
            onClick={newRound}
            className="px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold
              shadow-lg shadow-emerald-500/25 transition-all active:scale-95 text-base cursor-pointer"
          >
            New round
          </button>
          {(player?.chips ?? 0) <= 0 && (
            <button
              type="button"
              onClick={resetGame}
              className="text-sm text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              Out of chips? Reset game
            </button>
          )}
        </div>
      )}
    </>
  );

  return (
    <CasinoTable
      headerSlot={header}
      dealerSlot={dealer}
      playerSlots={playerSeats}
      messageSlot={message}
      controlsSlot={controls}
      tableLayout={tableLayoutSlice}
    />
  );
}
