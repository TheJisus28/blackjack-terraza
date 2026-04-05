"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PlayerAction } from "@/lib/blackjack/types";
import { useMultiplayer } from "@/hooks/use-multiplayer";
import { CasinoTable } from "./CasinoTable";
import { DealerArea } from "./DealerArea";
import { PlayerSeat, SeatsArc } from "./PlayerSeat";
import { ActionBar } from "./ActionBar";
import { BettingControls } from "./BettingControls";
import {
  RESULTS_TIMER_S,
  BETTING_TIMER_S,
  CARD_ANIM_DELAY_PER_CARD_MS,
  CARD_ANIM_BASE_DELAY_MS,
  COUNTDOWN_WARNING_THRESHOLD_S,
} from "@/lib/blackjack/constants";

interface MultiplayerTableProps {
  tableId: string;
}

export function MultiplayerTable({ tableId }: MultiplayerTableProps) {
  const {
    gameState,
    tableInfo,
    myPlayer,
    playerId,
    isMyTurn,
    connected,
    loading,
    error,
    sendAction,
  } = useMultiplayer({ tableId });

  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const prevPhaseRef = useRef(gameState?.phase);
  const timerSentRef = useRef(false);

  // Result display delay (wait for dealer animation)
  useEffect(() => {
    if (!gameState) return;
    if (gameState.phase === "finished" && prevPhaseRef.current !== "finished") {
      setShowResult(false);
      const dealerCards = gameState.dealer.cards.length;
      const delay = dealerCards * CARD_ANIM_DELAY_PER_CARD_MS + CARD_ANIM_BASE_DELAY_MS;
      const timer = setTimeout(() => setShowResult(true), delay);
      prevPhaseRef.current = gameState.phase;
      return () => clearTimeout(timer);
    }
    if (gameState.phase !== "finished") {
      setShowResult(false);
    }
    prevPhaseRef.current = gameState.phase;
  }, [gameState?.phase, gameState?.dealer.cards.length]);

  // Timer logic: auto_clear after results, auto_deal after betting
  useEffect(() => {
    if (!gameState) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    if (gameState.phase === "finished" && gameState.roundEndedAt) {
      timerSentRef.current = false;
      interval = setInterval(() => {
        const elapsed = (Date.now() - gameState.roundEndedAt!) / 1000;
        const remaining = Math.max(0, RESULTS_TIMER_S - elapsed);
        setCountdown(Math.ceil(remaining));

        if (remaining <= 0 && !timerSentRef.current) {
          timerSentRef.current = true;
          sendAction("auto_clear");
        }
      }, 250);
    } else if (gameState.phase === "betting" && gameState.bettingStartedAt) {
      timerSentRef.current = false;
      interval = setInterval(() => {
        const elapsed = (Date.now() - gameState.bettingStartedAt!) / 1000;
        const remaining = Math.max(0, BETTING_TIMER_S - elapsed);
        setCountdown(Math.ceil(remaining));

        if (remaining <= 0 && !timerSentRef.current) {
          timerSentRef.current = true;
          sendAction("auto_deal");
        }
      }, 250);
    } else {
      setCountdown(null);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameState?.phase, gameState?.roundEndedAt, gameState?.bettingStartedAt, sendAction]);

  // Keyboard shortcuts
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

  const copyInviteLink = useCallback(async () => {
    const code = (tableInfo as Record<string, string>)?.invite_code;
    if (!code) return;
    const url = `${window.location.origin}/table/${tableId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [tableInfo, tableId]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0f0f1a]">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !gameState) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#0f0f1a] gap-4">
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

  const pseudoGameState = { ...gameState, deck: [] as never[] };
  const inviteCode = (tableInfo as Record<string, string>)?.invite_code ?? "";
  const hasBet = myPlayer?.hands.length ? myPlayer.hands[0]?.bet > 0 : false;

  const header = (
    <header className="relative z-10 w-full flex items-center justify-between px-4 sm:px-6 py-3 bg-black/40 backdrop-blur-sm border-b border-white/5">
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
  );

  const dealer = gameState.dealer.cards.length > 0
    ? <DealerArea gameState={pseudoGameState} />
    : <div className="text-emerald-300/30 text-xs uppercase tracking-widest font-semibold">Dealer</div>;

  const shouldShowMessage = gameState.phase === "finished" ? showResult : !!gameState.message;

  const message = shouldShowMessage && gameState.message ? (
    <p
      className="text-center font-bold text-sm sm:text-lg px-4 py-1.5 rounded-full w-fit mx-auto
        text-white/80 bg-black/20 border border-white/10"
      style={{ animation: "resultPop 0.5s cubic-bezier(0.16, 1, 0.3, 1) both" }}
    >
      {gameState.message}
    </p>
  ) : undefined;

  const playerSlots = (
    <SeatsArc count={gameState.players.length}>
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
    </SeatsArc>
  );

  const countdownBar = countdown !== null && countdown > 0 && (
    gameState.phase === "betting" || gameState.phase === "finished"
  ) ? (
    <div className="flex items-center justify-center gap-2 mb-3">
      <div className="relative w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
          style={{
            width: `${(countdown / (gameState.phase === "betting" ? BETTING_TIMER_S : RESULTS_TIMER_S)) * 100}%`,
            backgroundColor: countdown <= COUNTDOWN_WARNING_THRESHOLD_S ? "#f87171" : "#34d399",
          }}
        />
      </div>
      <span className={`text-xs tabular-nums font-bold ${countdown <= COUNTDOWN_WARNING_THRESHOLD_S ? "text-red-400" : "text-emerald-400"}`}>
        {countdown}s
      </span>
    </div>
  ) : null;

  const controls = (
    <>
      {/* Waiting - any player can start */}
      {gameState.phase === "waiting" && (
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => sendAction("start_game")}
            disabled={gameState.players.length < 1}
            className="px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold
              shadow-lg shadow-emerald-500/25 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            Empezar
          </button>
          <p className="text-xs text-gray-500">
            {gameState.players.length} jugador
            {gameState.players.length !== 1 ? "es" : ""} en la mesa
          </p>
        </div>
      )}

      {/* Finished - show countdown */}
      {gameState.phase === "finished" && showResult && (
        <div className="flex flex-col items-center gap-2">
          {countdownBar}
          <p className="text-xs text-gray-500">
            Siguiente ronda en breve...
          </p>
        </div>
      )}

      {/* Betting */}
      {gameState.phase === "betting" && myPlayer && !hasBet && (
        <div className="flex flex-col items-center gap-2">
          {countdownBar}
          <BettingControls
            minBet={gameState.minBet}
            maxBet={gameState.maxBet}
            chips={myPlayer.chips}
            onBet={(amount) => sendAction("bet", amount)}
          />
        </div>
      )}

      {gameState.phase === "betting" && hasBet && (
        <div className="flex flex-col items-center gap-2">
          {countdownBar}
          <p className="text-center text-emerald-300 text-sm font-medium">
            Apuesta colocada! Esperando a los demas...
          </p>
        </div>
      )}

      {/* Betting phase but player joined mid-round (no hands yet) */}
      {gameState.phase === "betting" && !myPlayer && (
        <div className="flex flex-col items-center gap-2">
          {countdownBar}
          <p className="text-center text-gray-400 text-sm">
            Observando...
          </p>
        </div>
      )}

      {/* Playing - my turn */}
      {gameState.phase === "playing" && isMyTurn && (
        <ActionBar
          gameState={pseudoGameState}
          onAction={(act) => sendAction(act)}
        />
      )}

      {/* Playing - not my turn */}
      {gameState.phase === "playing" && !isMyTurn && myPlayer && myPlayer.hands.length > 0 && (
        <p className="text-center text-gray-400 text-sm">
          Turno de{" "}
          <span className="text-white font-medium">
            {gameState.players[gameState.activePlayerIndex]?.name}
          </span>
        </p>
      )}

      {/* Joined mid-round — watching */}
      {gameState.phase === "playing" && myPlayer && myPlayer.hands.length === 0 && (
        <p className="text-center text-gray-400 text-sm">
          Te uniste a mitad de ronda. Podras jugar en la siguiente.
        </p>
      )}
    </>
  );

  return (
    <CasinoTable
      headerSlot={header}
      dealerSlot={dealer}
      playerSlots={playerSlots}
      messageSlot={message}
      controlsSlot={controls}
    />
  );
}
