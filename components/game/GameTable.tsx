"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { PlayerAction } from "@/lib/blackjack/types";
import { useGame } from "@/hooks/use-game";
import { DealerArea } from "./DealerArea";
import { HandDisplay } from "./HandDisplay";
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

  return (
    <div className="relative flex flex-col items-center justify-between min-h-[100dvh] bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 overflow-hidden">
      {/* Felt texture overlay */}
      <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%224%22%20height%3D%224%22%3E%3Crect%20width%3D%221%22%20height%3D%221%22%20fill%3D%22%23fff%22%2F%3E%3C%2Fsvg%3E')] pointer-events-none" />

      {/* Top bar */}
      <header className="relative z-10 w-full flex items-center justify-between px-4 sm:px-6 py-3 bg-black/30 backdrop-blur-sm border-b border-white/5">
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
            onClick={resetGame}
            className="text-xs text-white/50 hover:text-white/80 transition-colors cursor-pointer"
          >
            Reiniciar
          </button>
        </div>
      </header>

      {/* Dealer section */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center pt-6 pb-2">
        <DealerArea gameState={gameState} />
      </section>

      {/* Message area */}
      {gameState.message && (
        <div className="relative z-10 py-2">
          <p
            className={`text-center font-bold text-lg px-6 py-2 rounded-full
              ${resultOutcome === "blackjack" ? "text-yellow-300 bg-yellow-500/10 border border-yellow-500/20" : ""}
              ${resultOutcome === "win" ? "text-emerald-300 bg-emerald-500/10 border border-emerald-500/20" : ""}
              ${resultOutcome === "lose" ? "text-red-300 bg-red-500/10 border border-red-500/20" : ""}
              ${resultOutcome === "push" ? "text-blue-300 bg-blue-500/10 border border-blue-500/20" : ""}
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
        </div>
      )}

      {/* Player section */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center pb-4">
        {player && player.hands.length > 0 && (
          <div className="flex gap-6 flex-wrap justify-center">
            {player.hands.map((hand, i) => (
              <HandDisplay
                key={i}
                hand={hand}
                isActive={
                  gameState.phase === "playing" &&
                  gameState.activePlayerIndex === 0 &&
                  player.activeHandIndex === i
                }
                label={player.hands.length > 1 ? `Mano ${i + 1}` : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {/* Controls */}
      <section className="relative z-10 w-full max-w-lg px-4 pb-6">
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
      </section>
    </div>
  );
}
