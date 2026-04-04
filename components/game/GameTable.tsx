"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { PlayerAction } from "@/lib/blackjack/types";
import { useGame } from "@/hooks/use-game";
import { CasinoTable } from "./CasinoTable";
import { DealerArea } from "./DealerArea";
import { PlayerSeat, SeatsArc } from "./PlayerSeat";
import { ActionBar } from "./ActionBar";
import { BettingControls } from "./BettingControls";

export function GameTable() {
  const { gameState, player, lastResults, bet, action, newRound, resetGame } =
    useGame("Jugador");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (gameState.phase !== "playing") return;

      const keyMap: Record<string, PlayerAction> = {
        h: "hit",
        s: "stand",
        d: "double",
        p: "split",
        r: "surrender",
      };

      const act = keyMap[e.key.toLowerCase()];
      if (act) {
        e.preventDefault();
        action(act);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState.phase, action]);

  const resultOutcome = lastResults[0]?.outcome;

  const header = (
    <header className="relative z-10 w-full flex items-center justify-between px-4 sm:px-6 py-3 bg-black/40 backdrop-blur-sm border-b border-white/5">
      <Link
        href="/"
        className="flex items-center gap-2 text-lg font-bold text-white tracking-tight hover:opacity-80 transition-opacity"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white/50">
          <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
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
          onClick={resetGame}
          className="text-xs text-white/50 hover:text-white/80 transition-colors cursor-pointer"
        >
          Reiniciar
        </button>
      </div>
    </header>
  );

  const dealer = <DealerArea gameState={gameState} />;

  const message = gameState.message ? (
    <p
      className={`text-center font-bold text-sm sm:text-lg px-4 py-1.5 rounded-full w-fit mx-auto
        ${resultOutcome === "blackjack" ? "text-yellow-300 bg-yellow-500/15 border border-yellow-500/20" : ""}
        ${resultOutcome === "win" ? "text-emerald-300 bg-emerald-500/15 border border-emerald-500/20" : ""}
        ${resultOutcome === "lose" ? "text-red-300 bg-red-500/15 border border-red-500/20" : ""}
        ${resultOutcome === "push" ? "text-blue-300 bg-blue-500/15 border border-blue-500/20" : ""}
        ${!resultOutcome ? "text-white/80" : ""}
      `}
      style={
        resultOutcome
          ? { animation: "resultPop 0.5s cubic-bezier(0.16, 1, 0.3, 1) both" }
          : undefined
      }
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
          isCurrentTurn={gameState.phase === "playing"}
          isMe
        />,
      ]}
    </SeatsArc>
  ) : null;

  const controls = (
    <>
      {gameState.phase === "betting" && player && (
        <BettingControls
          minBet={gameState.minBet}
          maxBet={gameState.maxBet}
          chips={player.chips}
          onBet={bet}
        />
      )}

      {gameState.phase === "playing" && (
        <ActionBar gameState={gameState} onAction={action} />
      )}

      {gameState.phase === "finished" && (
        <div
          className="flex flex-col items-center gap-3"
          style={{ animation: "fadeInUp 0.4s ease-out 0.3s both" }}
        >
          <button
            onClick={newRound}
            className="px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold
              shadow-lg shadow-emerald-500/25 transition-all active:scale-95 text-base cursor-pointer"
          >
            Nueva Ronda
          </button>
          {(player?.chips ?? 0) <= 0 && (
            <button
              onClick={resetGame}
              className="text-sm text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              Sin fichas? Reiniciar juego
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
    />
  );
}
