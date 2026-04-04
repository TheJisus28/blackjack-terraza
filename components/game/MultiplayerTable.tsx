"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PlayerAction } from "@/lib/blackjack/types";
import { useMultiplayer } from "@/hooks/use-multiplayer";
import { DealerArea } from "./DealerArea";
import { PlayerSeat } from "./PlayerSeat";
import { ActionBar } from "./ActionBar";
import { BettingControls } from "./BettingControls";

interface MultiplayerTableProps {
  tableId: string;
}

export function MultiplayerTable({ tableId }: MultiplayerTableProps) {
  const {
    gameState,
    tableInfo,
    myPlayer,
    playerId,
    isAdmin,
    isMyTurn,
    connected,
    loading,
    error,
    sendAction,
    leaveTable,
  } = useMultiplayer({ tableId });

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!gameState) return;
    if (gameState.phase !== "playing") return;

    function handleKeyDown(e: KeyboardEvent) {
      if (!isMyTurn) return;
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
        sendAction(act);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState?.phase, isMyTurn, sendAction]);

  const copyInviteLink = async () => {
    const code = (tableInfo as Record<string, string>)?.invite_code;
    if (!code) return;
    const url = `${window.location.origin}/table/${tableId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !gameState) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 gap-4">
        <p className="text-red-400 font-semibold">{error ?? "Error"}</p>
        <Link
          href="/lobby"
          className="text-emerald-400 hover:text-emerald-300 text-sm transition-colors"
        >
          Volver al lobby
        </Link>
      </div>
    );
  }

  // Build a pseudo GameState for DealerArea/ActionBar (they expect full GameState with deck)
  const pseudoGameState = { ...gameState, deck: [] as never[] };
  const inviteCode = (tableInfo as Record<string, string>)?.invite_code ?? "";

  const hasBet = myPlayer?.hands.length ? myPlayer.hands[0]?.bet > 0 : false;

  return (
    <div className="relative flex flex-col min-h-[100dvh] bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%224%22%20height%3D%224%22%3E%3Crect%20width%3D%221%22%20height%3D%221%22%20fill%3D%22%23fff%22%2F%3E%3C%2Fsvg%3E')] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full flex items-center justify-between px-4 sm:px-6 py-3 bg-black/30 backdrop-blur-sm border-b border-white/5">
        <Link
          href="/lobby"
          className="flex items-center gap-2 text-lg font-bold text-white hover:opacity-80 transition-opacity"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white/50">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
          {(tableInfo as Record<string, string>)?.name ?? "Mesa"}
        </Link>

        <div className="flex items-center gap-3">
          {inviteCode && (
            <button
              onClick={copyInviteLink}
              className="text-xs text-gray-400 hover:text-white bg-white/5 px-2.5 py-1 rounded-md
                transition-colors cursor-pointer font-mono tracking-wider"
            >
              {copied ? "Copiado!" : inviteCode}
            </button>
          )}

          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
            />
            <span className="text-xs text-gray-400">
              {gameState.players.length}p
            </span>
          </div>

          {myPlayer && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <span className="text-sm font-semibold text-yellow-300 tabular-nums">
                ${myPlayer.chips}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Dealer */}
      <section className="relative z-10 flex flex-col items-center justify-center pt-6 pb-2">
        {gameState.dealer.cards.length > 0 && (
          <DealerArea gameState={pseudoGameState} />
        )}
      </section>

      {/* Message */}
      {gameState.message && (
        <div className="relative z-10 py-2 text-center">
          <p className="text-white/80 font-bold text-lg px-4">
            {gameState.message}
          </p>
        </div>
      )}

      {/* All players */}
      <section className="relative z-10 flex-1 px-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
          {gameState.players.map((player, i) => (
            <PlayerSeat
              key={player.id}
              player={player}
              isCurrentTurn={
                gameState.phase === "playing" &&
                gameState.activePlayerIndex === i
              }
              isMe={player.id === playerId}
            />
          ))}
        </div>
      </section>

      {/* Controls */}
      <section className="relative z-10 w-full max-w-lg mx-auto px-4 pb-6">
        {/* Waiting phase - admin can start */}
        {(gameState.phase === "waiting" || gameState.phase === "finished") &&
          isAdmin && (
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => sendAction("start_round")}
                disabled={gameState.players.length < 1}
                className="px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold
                  shadow-lg shadow-emerald-500/25 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                {gameState.phase === "finished"
                  ? "Nueva Ronda"
                  : "Iniciar Juego"}
              </button>
              <p className="text-xs text-gray-500">
                {gameState.players.length} jugador
                {gameState.players.length !== 1 ? "es" : ""} en la mesa
              </p>
            </div>
          )}

        {/* Waiting phase - non-admin */}
        {(gameState.phase === "waiting" || gameState.phase === "finished") &&
          !isAdmin && (
            <p className="text-center text-gray-400 text-sm">
              Esperando que el admin inicie la ronda...
            </p>
          )}

        {/* Betting phase */}
        {gameState.phase === "betting" && myPlayer && !hasBet && (
          <BettingControls
            minBet={gameState.minBet}
            maxBet={gameState.maxBet}
            chips={myPlayer.chips}
            onBet={(amount) => sendAction("bet", amount)}
          />
        )}

        {gameState.phase === "betting" && hasBet && (
          <p className="text-center text-emerald-300 text-sm font-medium">
            Apuesta colocada! Esperando a los demas...
          </p>
        )}

        {/* Playing phase - my turn */}
        {gameState.phase === "playing" && isMyTurn && (
          <ActionBar
            gameState={pseudoGameState}
            onAction={(act) => sendAction(act)}
          />
        )}

        {/* Playing phase - not my turn */}
        {gameState.phase === "playing" && !isMyTurn && (
          <p className="text-center text-gray-400 text-sm">
            Turno de{" "}
            <span className="text-white font-medium">
              {gameState.players[gameState.activePlayerIndex]?.name}
            </span>
          </p>
        )}
      </section>
    </div>
  );
}
