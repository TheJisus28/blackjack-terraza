"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientGameState, PlayerAction } from "@/game/simulation/blackjack";
import { PHASE, playingParticipants } from "@/game/simulation/blackjack";
import {
  useMultiplayer,
  type UseMultiplayerReturn,
} from "@/game/presentation/blackjack/runtime/use-multiplayer";
import { useTableSurfaceHud } from "@/game/presentation/blackjack/runtime/use-table-surface-hud";
import { useBlackjackPlayingHotkeys } from "@/game/presentation/blackjack/runtime/use-blackjack-playing-hotkeys";
import { useMultiplayerPhaseTimers } from "@/game/presentation/blackjack/runtime/use-multiplayer-phase-timers";
import { useSounds } from "@/game/presentation/blackjack/runtime/use-sounds";
import { CasinoTable } from "@/game/presentation/blackjack/widgets/CasinoTable";
import { DealerArea } from "@/game/presentation/blackjack/widgets/DealerArea";
import { PlayerSeat, SeatsArc } from "@/game/presentation/blackjack/widgets/PlayerSeat";
import { ActionBar } from "@/game/presentation/blackjack/widgets/ActionBar";
import { BettingControls } from "@/game/presentation/blackjack/widgets/BettingControls";
import { InsuranceControls } from "@/game/presentation/blackjack/widgets/InsuranceControls";
import { TableCountdownBar } from "@/game/presentation/blackjack/widgets/table-countdown-bar";
import {
  TableSessionError,
  TableSessionLoading,
} from "@/game/presentation/blackjack/widgets/table-session-gate";
import { TableOverflowMenu } from "@/game/presentation/blackjack/widgets/table-overflow-menu";
import { dealLayoutSignature } from "@/game/simulation/blackjack";
import {
  SESSION_ACTION,
  type BlackjackSessionTimerAction,
} from "@/shared/types/blackjack-session-action";
import { sounds } from "@/shared/audio/sounds";

interface MultiplayerTableProps {
  tableId: string;
}

export function MultiplayerTable({ tableId }: MultiplayerTableProps) {
  const mp = useMultiplayer({ tableId });

  if (mp.loading) {
    return <TableSessionLoading />;
  }

  if (mp.error || !mp.gameState) {
    return <TableSessionError message={mp.error ?? "Error"} />;
  }

  return (
    <MultiplayerTableLoaded
      tableId={tableId}
      gameState={mp.gameState}
      tableInfo={mp.tableInfo}
      myPlayer={mp.myPlayer}
      playerId={mp.playerId}
      isMyTurn={mp.isMyTurn}
      connected={mp.connected}
      sendAction={mp.sendAction}
      leaveTable={mp.leaveTable}
    />
  );
}

interface MultiplayerTableLoadedProps {
  tableId: string;
  gameState: ClientGameState;
  tableInfo: UseMultiplayerReturn["tableInfo"];
  myPlayer: UseMultiplayerReturn["myPlayer"];
  playerId: string;
  isMyTurn: boolean;
  connected: boolean;
  sendAction: UseMultiplayerReturn["sendAction"];
  leaveTable: UseMultiplayerReturn["leaveTable"];
}

function MultiplayerTableLoaded({
  tableId,
  gameState,
  tableInfo,
  myPlayer,
  playerId,
  isMyTurn,
  connected,
  sendAction,
  leaveTable,
}: MultiplayerTableLoadedProps) {
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const seatedCount = playingParticipants(gameState.players).length;

  const sendTimerAction = useCallback(
    (action: BlackjackSessionTimerAction) => {
      void sendAction(action);
    },
    [sendAction],
  );

  const playingHotkeyAction = useCallback(
    (a: PlayerAction) => {
      void sendAction(a);
    },
    [sendAction],
  );

  const { countdownSec: countdown } = useMultiplayerPhaseTimers(
    gameState,
    sendTimerAction,
  );

  const mpLayoutSig = dealLayoutSignature({
    players: gameState.players,
    dealer: gameState.dealer,
  });

  const tableLayoutSlice = useMemo(
    () => ({ players: gameState.players, dealer: gameState.dealer }),
    [mpLayoutSig],
  );

  const { hudInteractive } = useTableSurfaceHud(
    "multiplayer",
    tableLayoutSlice,
    gameState.phase,
    mpLayoutSig,
  );

  useBlackjackPlayingHotkeys(gameState.phase, isMyTurn, playingHotkeyAction);

  const totalPlayerCards = gameState.players.reduce(
    (sum, p) => sum + p.hands.reduce((s, h) => s + h.cards.length, 0),
    0,
  );

  useSounds({
    phase: gameState.phase,
    dealerCardCount: gameState.dealer.cards.length,
    playerCardCount: totalPlayerCards,
    resultOutcome: undefined,
    isMyTurn,
    tableForSequence: tableLayoutSlice,
  });

  const copyInviteLink = useCallback(async () => {
    const code = tableInfo?.invite_code;
    if (!code) return;
    const url = `${window.location.origin}/table/${tableId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [tableInfo, tableId]);

  const pseudoGameState = { ...gameState, deck: [] as never[] };
  const inviteCode = tableInfo?.invite_code ?? "";
  const hasBet = myPlayer?.hands.length ? myPlayer.hands[0]?.bet > 0 : false;

  const goToLobby = useCallback(() => {
    void leaveTable().then(() => router.push("/lobby"));
  }, [leaveTable, router]);

  const canOfferWatch =
    myPlayer &&
    !myPlayer.spectator &&
    (gameState.phase === PHASE.WAITING ||
      gameState.phase === PHASE.FINISHED ||
      (gameState.phase === PHASE.BETTING && !hasBet));

  const header = (
    <header className="relative z-40 w-full flex items-center justify-between px-4 sm:px-6 py-3 bg-black/40 backdrop-blur-sm border-b border-white/5">
      <div className="min-w-0 pr-2">
        <h1 className="text-lg font-bold text-white truncate">
          {tableInfo?.name ?? "Table"}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {inviteCode && (
          <button
            type="button"
            onClick={copyInviteLink}
            className="text-xs text-gray-400 hover:text-white bg-white/5 px-2.5 py-1 rounded-md
              transition-colors cursor-pointer font-mono tracking-wider"
          >
            {copied ? "Copied!" : inviteCode}
          </button>
        )}

        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
            title={
              connected
                ? "Tu cliente conectado al canal en tiempo real"
                : "Reconectando al canal…"
            }
          />
          <span
            className="text-xs text-gray-400"
            title="Jugadores sentados / total en mesa (incl. observando)"
          >
            {seatedCount}/{gameState.players.length}
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

        <TableOverflowMenu
          isSpectator={!!myPlayer?.spectator}
          canStandUp={!!canOfferWatch}
          canSitIn={!!myPlayer?.spectator}
          onStandUp={() => void sendAction(SESSION_ACTION.WATCH_TABLE)}
          onSitIn={() => void sendAction(SESSION_ACTION.SIT_IN)}
          onLeaveTable={goToLobby}
        />
      </div>
    </header>
  );

  const dealer =
    gameState.dealer.cards.length > 0 ? (
      <DealerArea gameState={pseudoGameState} />
    ) : (
      <div className="text-emerald-300/30 text-xs uppercase tracking-widest font-semibold">
        Dealer
      </div>
    );

  const shouldShowMessage = hudInteractive && !!gameState.message;

  const message =
    shouldShowMessage && gameState.message ? (
      <p
        className="text-center font-bold text-sm sm:text-lg px-4 py-1.5 rounded-full w-fit mx-auto
        text-white/80 bg-black/20 border border-white/10"
        style={{
          animation: "resultPop 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
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
          tableLayout={tableLayoutSlice}
          isCurrentTurn={
            (gameState.phase === PHASE.PLAYING &&
              gameState.activePlayerIndex === i) ||
            (gameState.phase === PHASE.INSURANCE &&
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
    (gameState.phase === PHASE.BETTING ||
      gameState.phase === PHASE.FINISHED ||
      gameState.phase === PHASE.INSURANCE ||
      (gameState.phase === PHASE.RESOLVING &&
        gameState.resolvingRevealStartedAt != null)) ? (
      <TableCountdownBar phase={gameState.phase} countdownSec={countdown} />
    ) : null;

  const controls = (
    <>
      {gameState.phase === PHASE.RESOLVING &&
        gameState.resolvingRevealStartedAt != null &&
        hudInteractive && (
          <div className="flex flex-col items-center gap-2 mb-2">
            {countdownBar}
            <p className="text-center text-amber-200/95 text-sm font-medium max-w-sm">
              Dealer blackjack — hands settle when the timer ends.
            </p>
          </div>
        )}

      {gameState.phase === PHASE.WAITING && (
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => sendAction(SESSION_ACTION.START_GAME)}
            disabled={seatedCount < 1}
            className="px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold
              shadow-lg shadow-emerald-500/25 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            Start game
          </button>
          <p className="text-xs text-gray-500">
            {seatedCount} seated
            {gameState.players.length !== seatedCount
              ? ` · ${gameState.players.length} in room`
              : ""}
          </p>
        </div>
      )}

      {gameState.phase === PHASE.FINISHED && hudInteractive && (
        <div className="flex flex-col items-center gap-2">
          {countdownBar}
          <p className="text-xs text-gray-500">Next round starting soon...</p>
        </div>
      )}

      {gameState.phase === PHASE.INSURANCE &&
        hudInteractive &&
        myPlayer &&
        hasBet &&
        myPlayer.insuranceWager == null && (
          <div className="flex flex-col items-center gap-2 mb-3">
            {countdownBar}
            <InsuranceControls
              maxInsurance={Math.floor(myPlayer.hands[0].bet / 2)}
              chips={myPlayer.chips}
              onConfirm={(amount) =>
                sendAction(SESSION_ACTION.INSURANCE_ACCEPT, amount)
              }
              onDecline={() =>
                sendAction(SESSION_ACTION.INSURANCE_DECLINE)
              }
              countdownSec={countdown}
            />
          </div>
        )}

      {gameState.phase === PHASE.INSURANCE &&
        hudInteractive &&
        myPlayer &&
        hasBet &&
        myPlayer.insuranceWager != null && (
          <div className="flex flex-col items-center gap-2 mb-3">
            {countdownBar}
            <p className="text-center text-gray-400 text-sm">
              Insurance decided — waiting for others...
            </p>
          </div>
        )}

      {gameState.phase === PHASE.INSURANCE &&
        hudInteractive &&
        (!myPlayer || !hasBet) && (
          <div className="flex flex-col items-center gap-2 mb-3">
            <p className="text-center text-gray-400 text-sm">
              Dealer shows ace — players are choosing insurance...
            </p>
          </div>
        )}

      {gameState.phase === PHASE.BETTING && myPlayer?.spectator && (
        <div className="flex flex-col items-center gap-2">
          {countdownBar}
          <p className="text-center text-sky-200/90 text-sm max-w-xs px-2">
            Watching — use the menu and tap{" "}
            <span className="font-semibold text-white">Sit in to play</span> to bet
            this round.
          </p>
        </div>
      )}

      {gameState.phase === PHASE.BETTING &&
        myPlayer &&
        !myPlayer.spectator &&
        myPlayer.chips > 0 &&
        !hasBet && (
          <div className="flex flex-col items-center gap-2">
            {countdownBar}
            <BettingControls
              minBet={gameState.minBet}
              maxBet={gameState.maxBet}
              chips={myPlayer.chips}
              onBet={(amount) => {
                sounds.chipPlace();
                void sendAction(SESSION_ACTION.BET, amount);
              }}
            />
          </div>
        )}

      {gameState.phase === PHASE.BETTING &&
        hasBet &&
        myPlayer &&
        !myPlayer.spectator && (
          <div className="flex flex-col items-center gap-2">
            {countdownBar}
            <p className="text-center text-emerald-300 text-sm font-medium">
              Bet placed! Waiting for others...
            </p>
          </div>
        )}

      {gameState.phase === PHASE.BETTING && !myPlayer && (
        <div className="flex flex-col items-center gap-2">
          {countdownBar}
          <p className="text-center text-gray-400 text-sm">
            Join the table to bet this round.
          </p>
        </div>
      )}

      {gameState.phase === PHASE.PLAYING && isMyTurn && hudInteractive && (
        <ActionBar
          gameState={pseudoGameState}
          onAction={(act) => void sendAction(act)}
        />
      )}

      {gameState.phase === PHASE.PLAYING &&
        !isMyTurn &&
        hudInteractive &&
        myPlayer &&
        (myPlayer.spectator || myPlayer.hands.length > 0) && (
          <p className="text-center text-gray-400 text-sm">
            Turn:{" "}
            <span className="text-white font-medium">
              {gameState.players[gameState.activePlayerIndex]?.name}
            </span>
          </p>
        )}

      {gameState.phase === PHASE.DEALER_TURN &&
        hudInteractive &&
        myPlayer?.spectator && (
          <p className="text-center text-gray-400 text-sm">
            Turn:{" "}
            <span className="text-white font-medium">Dealer</span>
          </p>
        )}

      {gameState.phase === PHASE.PLAYING &&
        myPlayer &&
        !myPlayer.spectator &&
        myPlayer.hands.length === 0 && (
          <p className="text-center text-gray-400 text-sm">
            You joined mid-round. You can play the next one.
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
      tableLayout={tableLayoutSlice}
    />
  );
}
