"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PlayerAction } from "@/lib/blackjack/types";
import { useMultiplayer } from "@/hooks/use-multiplayer";
import { CasinoTable } from "./CasinoTable";
import { DealerArea } from "./DealerArea";
import { PlayerSeat, SeatsArc } from "./PlayerSeat";
import { ActionBar } from "./ActionBar";
import { BettingControls } from "./BettingControls";
import { InsuranceControls } from "./InsuranceControls";
import {
  RESULTS_TIMER_S,
  RESULTS_REBUY_LEAD_S,
  BETTING_TIMER_S,
  INSURANCE_TIMER_S,
  CARD_ANIM_BASE_DELAY_MS,
  COUNTDOWN_WARNING_THRESHOLD_S,
} from "@/lib/blackjack/constants";
import {
  dealLayoutSignature,
  feedbackWaveDurationMs,
  maxDealGlobalIndex,
  totalCardsOnTable,
} from "@/lib/blackjack/deal-sequence";
import { useSounds } from "@/hooks/use-sounds";
import { sounds } from "@/lib/sounds";

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
  const prevFeedbackMaxGRef = useRef(-1);
  const timerSentRef = useRef(false);
  const autoRebuyResultsSentRef = useRef(false);
  const lastTickRef = useRef<number | null>(null);

  const mpLayoutSig = gameState
    ? dealLayoutSignature({
        players: gameState.players,
        dealer: gameState.dealer,
      })
    : "";

  const tableLayoutSlice = useMemo(() => {
    if (!gameState) return undefined;
    return { players: gameState.players, dealer: gameState.dealer };
  }, [mpLayoutSig]);

  useEffect(() => {
    autoRebuyResultsSentRef.current = false;
  }, [gameState?.phase, gameState?.roundEndedAt]);

  // Animation delay: hide messages/controls until card animations finish
  useEffect(() => {
    if (!gameState) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = gameState.phase;

    const isInitialDeal =
      prev === "betting" &&
      (gameState.phase === "playing" ||
        gameState.phase === "finished" ||
        gameState.phase === "insurance");
    const isRoundEndReveal =
      (prev === "playing" ||
        prev === "dealer_turn" ||
        prev === "insurance" ||
        prev === "resolving") &&
      gameState.phase === "finished";

    const layout = {
      players: gameState.players,
      dealer: gameState.dealer,
    };
    const total = totalCardsOnTable(layout);
    const maxG = maxDealGlobalIndex(layout);

    if (isInitialDeal || isRoundEndReveal) {
      setShowResult(false);
      const dealMs = feedbackWaveDurationMs(layout, prevFeedbackMaxGRef.current);
      const delay =
        dealMs <= 0 ? CARD_ANIM_BASE_DELAY_MS : dealMs + CARD_ANIM_BASE_DELAY_MS;
      const timer = setTimeout(() => setShowResult(true), delay);
      prevFeedbackMaxGRef.current = maxG;
      return () => clearTimeout(timer);
    }

    setShowResult(gameState.phase !== "finished" || prev === "finished");
    if (total === 0) prevFeedbackMaxGRef.current = -1;
    else if (gameState.phase !== "finished") {
      prevFeedbackMaxGRef.current = maxG;
    }
  }, [gameState?.phase, gameState?.dealer.cards.length, gameState?.players]);

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

        const anyBelowMin = gameState.players.some(
          (p) => p.chips < gameState.minBet,
        );
        if (
          anyBelowMin &&
          remaining <= RESULTS_REBUY_LEAD_S &&
          remaining > 0 &&
          !autoRebuyResultsSentRef.current
        ) {
          autoRebuyResultsSentRef.current = true;
          sendAction("auto_rebuy_results");
        }

        if (remaining <= 0 && !timerSentRef.current) {
          timerSentRef.current = true;
          sendAction("auto_clear");
        }
      }, 250);
    } else if (gameState.phase === "betting" && gameState.bettingStartedAt) {
      timerSentRef.current = false;
      lastTickRef.current = null;
      interval = setInterval(() => {
        const elapsed = (Date.now() - gameState.bettingStartedAt!) / 1000;
        const remaining = Math.max(0, BETTING_TIMER_S - elapsed);
        const rounded = Math.ceil(remaining);
        setCountdown(rounded);

        if (rounded > 0 && rounded <= COUNTDOWN_WARNING_THRESHOLD_S && rounded !== lastTickRef.current) {
          lastTickRef.current = rounded;
          sounds.tick();
        }

        if (remaining <= 0 && !timerSentRef.current) {
          timerSentRef.current = true;
          sendAction("auto_deal");
        }
      }, 250);
    } else if (gameState.phase === "insurance" && gameState.insuranceStartedAt) {
      timerSentRef.current = false;
      interval = setInterval(() => {
        const elapsed = (Date.now() - gameState.insuranceStartedAt!) / 1000;
        const remaining = Math.max(0, INSURANCE_TIMER_S - elapsed);
        setCountdown(Math.ceil(remaining));

        if (remaining <= 0 && !timerSentRef.current) {
          timerSentRef.current = true;
          sendAction("auto_insurance");
        }
      }, 250);
    } else {
      setCountdown(null);
      lastTickRef.current = null;
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [
    gameState?.phase,
    gameState?.roundEndedAt,
    gameState?.bettingStartedAt,
    gameState?.insuranceStartedAt,
    sendAction,
  ]);

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

  const totalPlayerCards = gameState?.players.reduce(
    (sum, p) => sum + p.hands.reduce((s, h) => s + h.cards.length, 0), 0,
  ) ?? 0;

  useSounds({
    phase: gameState?.phase ?? "waiting",
    dealerCardCount: gameState?.dealer.cards.length ?? 0,
    playerCardCount: totalPlayerCards,
    resultOutcome: undefined,
    isMyTurn,
    tableForSequence: tableLayoutSlice,
  });

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
  const tableLayoutForSeats = {
    players: gameState.players,
    dealer: gameState.dealer,
  };
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

  const shouldShowMessage = showResult && !!gameState.message;

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
          playerIndex={i}
          tableLayout={tableLayoutForSeats}
          isCurrentTurn={
            (gameState.phase === "playing" &&
              gameState.activePlayerIndex === i) ||
            (gameState.phase === "insurance" &&
              player.id === playerId &&
              (player.hands[0]?.bet ?? 0) > 0 &&
              player.insuranceWager == null)
          }
          isMe={player.id === playerId}
        />
      ))}
    </SeatsArc>
  );

  const countdownBar =
    countdown !== null &&
    countdown > 0 &&
    (gameState.phase === "betting" ||
      gameState.phase === "finished" ||
      gameState.phase === "insurance") ? (
    <div className="flex items-center justify-center gap-2 mb-3">
      <div className="relative w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
          style={{
            width: `${(countdown /
              (gameState.phase === "betting"
                ? BETTING_TIMER_S
                : gameState.phase === "insurance"
                  ? INSURANCE_TIMER_S
                  : RESULTS_TIMER_S)) *
              100}%`,
            backgroundColor:
              countdown <= COUNTDOWN_WARNING_THRESHOLD_S &&
              gameState.phase !== "insurance"
                ? "#f87171"
                : "#34d399",
          }}
        />
      </div>
      <span
        className={`text-xs tabular-nums font-bold ${
          countdown <= COUNTDOWN_WARNING_THRESHOLD_S && gameState.phase !== "insurance"
            ? "text-red-400"
            : "text-emerald-400"
        }`}
      >
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

      {gameState.phase === "insurance" && showResult && myPlayer && hasBet && myPlayer.insuranceWager == null && (
        <div className="flex flex-col items-center gap-2 mb-3">
          {countdownBar}
          <InsuranceControls
            maxInsurance={Math.floor(myPlayer.hands[0].bet / 2)}
            chips={myPlayer.chips}
            onConfirm={(amount) => sendAction("insurance_accept", amount)}
            onDecline={() => sendAction("insurance_decline")}
            countdownSec={countdown}
          />
        </div>
      )}

      {gameState.phase === "insurance" && showResult && myPlayer && hasBet && myPlayer.insuranceWager != null && (
        <div className="flex flex-col items-center gap-2 mb-3">
          {countdownBar}
          <p className="text-center text-gray-400 text-sm">
            Seguro decidido — esperando a los demás...
          </p>
        </div>
      )}

      {gameState.phase === "insurance" && showResult && (!myPlayer || !hasBet) && (
        <div className="flex flex-col items-center gap-2 mb-3">
          <p className="text-center text-gray-400 text-sm">
            As del crupier — los jugadores deciden seguro...
          </p>
        </div>
      )}

      {/* Betting */}
      {gameState.phase === "betting" && myPlayer && myPlayer.chips > 0 && !hasBet && (
        <div className="flex flex-col items-center gap-2">
          {countdownBar}
          <BettingControls
            minBet={gameState.minBet}
            maxBet={gameState.maxBet}
            chips={myPlayer.chips}
            onBet={(amount) => { sounds.chipPlace(); sendAction("bet", amount); }}
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
      {gameState.phase === "playing" && isMyTurn && showResult && (
        <ActionBar
          gameState={pseudoGameState}
          onAction={(act) => sendAction(act)}
        />
      )}

      {/* Playing - not my turn */}
      {gameState.phase === "playing" && !isMyTurn && showResult && myPlayer && myPlayer.hands.length > 0 && (
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
      tableLayout={tableLayoutForSeats}
    />
  );
}
