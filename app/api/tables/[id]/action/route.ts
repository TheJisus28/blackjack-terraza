import { getSupabase } from "@/shared/lib/supabase";
import type { GameState } from "@/game/simulation/blackjack";
import {
  PHASE,
  placeBet,
  dealInitialCards,
  playerAction,
  runToCompletion,
  startBetting,
  autoClearTable,
  allBetsPlaced,
  rebuyPlayer,
  removePlayer,
  toClientState,
  deserializeDeck,
  serializeDeck,
  takeInsurance,
  declineInsurance,
  resolveInsurancePhase,
  autoRebuyBrokePlayersInResults,
  lobbyTableStatusAfterEngineStep,
  playingParticipants,
  RESULTS_DELAY_MS,
  BETTING_DELAY_MS,
  INSURANCE_DELAY_MS,
  MAX_INACTIVE_ROUNDS,
  RESULTS_TIMER_S,
  RESULTS_REBUY_LEAD_S,
  setPlayerSpectator,
} from "@/game/simulation/blackjack";
import {
  SESSION_ACTION,
  type BlackjackSessionAction,
} from "@/shared/types/blackjack-session-action";
import { broadcastToTable } from "@/shared/lib/broadcast";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as {
    playerId: string;
    action: BlackjackSessionAction;
    amount?: number;
  };

  const { playerId, action, amount } = body;

  if (!playerId || !action) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const sb = getSupabase();

  const { data: table, error } = await sb
    .from("game_tables")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !table) {
    return Response.json({ error: "Table not found" }, { status: 404 });
  }

  let gameState: GameState = {
    ...table.game_state,
    deck: deserializeDeck(table.deck_data),
  };

  if (!gameState.players.some((p) => p.id === playerId)) {
    return Response.json({ error: "You are not at this table" }, { status: 403 });
  }

  switch (action) {
    case SESSION_ACTION.START_GAME: {
      if (gameState.phase !== PHASE.WAITING) {
        return Response.json({ ok: true, state: toClientState(gameState) });
      }
      if (playingParticipants(gameState.players).length < 1) {
        return Response.json({ error: "No seated players" }, { status: 400 });
      }
      gameState = startBetting(gameState);
      break;
    }

    case SESSION_ACTION.AUTO_REBUY_RESULTS: {
      if (gameState.phase !== PHASE.FINISHED) {
        return Response.json({ ok: true, state: toClientState(gameState) });
      }
      const elapsedMs = Date.now() - (gameState.roundEndedAt ?? 0);
      const minElapsedMs = (RESULTS_TIMER_S - RESULTS_REBUY_LEAD_S) * 1000;
      if (elapsedMs < minElapsedMs) {
        return Response.json({ ok: true, state: toClientState(gameState) });
      }
      if (elapsedMs > RESULTS_TIMER_S * 1000 + 15_000) {
        return Response.json({ ok: true, state: toClientState(gameState) });
      }
      gameState = autoRebuyBrokePlayersInResults(gameState);
      break;
    }

    case SESSION_ACTION.AUTO_CLEAR: {
      if (gameState.phase !== PHASE.FINISHED) {
        return Response.json({ ok: true, state: toClientState(gameState) });
      }
      const elapsed = Date.now() - (gameState.roundEndedAt ?? 0);
      if (elapsed < RESULTS_DELAY_MS) {
        return Response.json({ ok: true, state: toClientState(gameState) });
      }
      gameState = autoRebuyBrokePlayersInResults(gameState);
      gameState = autoClearTable(gameState);
      break;
    }

    case SESSION_ACTION.AUTO_DEAL: {
      if (gameState.phase !== PHASE.BETTING) {
        return Response.json({ ok: true, state: toClientState(gameState) });
      }
      const bettingElapsed = Date.now() - (gameState.bettingStartedAt ?? 0);
      if (bettingElapsed < BETTING_DELAY_MS) {
        return Response.json({ ok: true, state: toClientState(gameState) });
      }

      // Track inactivity: increment for non-betters, reset for betters
      gameState = {
        ...gameState,
        players: gameState.players.map((p) => {
          const didBet =
            p.spectator || (p.hands.length > 0 && p.hands[0].bet > 0);
          return {
            ...p,
            inactiveRounds: didBet ? 0 : (p.inactiveRounds ?? 0) + 1,
          };
        }),
      };

      // Kick players inactive for too long
      const toKick = gameState.players.filter(
        (p) => (p.inactiveRounds ?? 0) >= MAX_INACTIVE_ROUNDS,
      );
      for (const p of toKick) {
        gameState = removePlayer(gameState, p.id);
      }

      if (gameState.players.length === 0) {
        await sb.from("game_tables").delete().eq("id", id);
        await broadcastToTable(id, { type: "table_closed" });
        return Response.json({ ok: true, state: null });
      }

      const hasBetters = gameState.players.some(
        (p) =>
          !p.spectator && p.hands.length > 0 && p.hands[0].bet > 0,
      );
      if (!hasBetters) {
        gameState = {
          ...gameState,
          bettingStartedAt: Date.now(),
          message: "No bets — new betting round",
        };
        break;
      }
      gameState = dealInitialCards(gameState);
      const { state: dealt } = runToCompletion(gameState);
      gameState = dealt;
      break;
    }

    case SESSION_ACTION.AUTO_INSURANCE: {
      if (gameState.phase !== PHASE.INSURANCE) {
        return Response.json({ ok: true, state: toClientState(gameState) });
      }
      const insElapsed = Date.now() - (gameState.insuranceStartedAt ?? 0);
      if (insElapsed < INSURANCE_DELAY_MS) {
        return Response.json({ ok: true, state: toClientState(gameState) });
      }
      const insRes = resolveInsurancePhase(gameState);
      gameState = insRes.state;
      break;
    }

    case SESSION_ACTION.INSURANCE_ACCEPT: {
      if (gameState.phase !== PHASE.INSURANCE) {
        return Response.json({ error: "Insurance not available" }, { status: 400 });
      }
      const acc = takeInsurance(gameState, playerId, amount);
      gameState = acc.state;
      break;
    }

    case SESSION_ACTION.INSURANCE_DECLINE: {
      if (gameState.phase !== PHASE.INSURANCE) {
        return Response.json({ error: "Insurance not available" }, { status: 400 });
      }
      const dec = declineInsurance(gameState, playerId);
      gameState = dec.state;
      break;
    }

    case SESSION_ACTION.WATCH_TABLE: {
      gameState = setPlayerSpectator(gameState, playerId, true);
      break;
    }

    case SESSION_ACTION.SIT_IN: {
      gameState = setPlayerSpectator(gameState, playerId, false);
      break;
    }

    case SESSION_ACTION.REBUY: {
      const player = gameState.players.find((p) => p.id === playerId);
      if (!player || player.spectator || player.chips >= gameState.minBet) {
        return Response.json({ error: "Rebuy not needed" }, { status: 400 });
      }
      if (player.hands.some((h) => h.bet > 0)) {
        return Response.json(
          { error: "Already bet this round; wait for the next" },
          { status: 400 },
        );
      }
      gameState = rebuyPlayer(gameState, playerId);
      break;
    }

    case SESSION_ACTION.BET: {
      if (gameState.phase !== PHASE.BETTING) {
        return Response.json({ error: "Not time to bet" }, { status: 400 });
      }
      if (!amount || amount <= 0) {
        return Response.json({ error: "Invalid bet" }, { status: 400 });
      }
      gameState = placeBet(gameState, playerId, amount);

      if (allBetsPlaced(gameState)) {
        gameState = dealInitialCards(gameState);
        const { state } = runToCompletion(gameState);
        gameState = state;
      }
      break;
    }

    case SESSION_ACTION.HIT:
    case SESSION_ACTION.STAND:
    case SESSION_ACTION.DOUBLE:
    case SESSION_ACTION.SPLIT:
    case SESSION_ACTION.SURRENDER: {
      if (gameState.phase === PHASE.INSURANCE) {
        return Response.json({ error: "Resolve insurance first" }, { status: 400 });
      }
      if (gameState.phase !== PHASE.PLAYING) {
        return Response.json({ error: "Not time to play" }, { status: 400 });
      }
      const doubleOpts =
        action === SESSION_ACTION.DOUBLE && amount != null && amount > 0
          ? { doubleAmount: amount }
          : undefined;
      gameState = playerAction(gameState, playerId, action, doubleOpts);
      const { state } = runToCompletion(gameState);
      gameState = state;
      break;
    }

    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }

  gameState = runToCompletion(gameState).state;

  const { error: updateError } = await sb
    .from("game_tables")
    .update({
      game_state: toClientState(gameState),
      deck_data: serializeDeck(gameState.deck),
      status: lobbyTableStatusAfterEngineStep(gameState.phase),
    })
    .eq("id", id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  await broadcastToTable(id, {
    type: "state_update",
    state: toClientState(gameState),
  });

  return Response.json({ ok: true, state: toClientState(gameState) });
}
