import { getSupabase } from "@/lib/supabase";
import {
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
} from "@/lib/blackjack/engine";
import type { GameState, PlayerAction } from "@/lib/blackjack/types";
import { broadcastToTable } from "@/lib/broadcast";
import { RESULTS_DELAY_MS, BETTING_DELAY_MS, MAX_INACTIVE_ROUNDS } from "@/lib/blackjack/constants";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as {
    playerId: string;
    action: "bet" | "start_game" | "auto_clear" | "auto_deal" | "rebuy" | PlayerAction;
    amount?: number;
  };

  const { playerId, action, amount } = body;

  if (!playerId || !action) {
    return Response.json({ error: "Faltan campos" }, { status: 400 });
  }

  const sb = getSupabase();

  const { data: table, error } = await sb
    .from("game_tables")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !table) {
    return Response.json({ error: "Mesa no encontrada" }, { status: 404 });
  }

  let gameState: GameState = {
    ...table.game_state,
    deck: deserializeDeck(table.deck_data),
  };

  if (!gameState.players.some((p) => p.id === playerId)) {
    return Response.json({ error: "No estás en esta mesa" }, { status: 403 });
  }

  switch (action) {
    case "start_game": {
      if (gameState.phase !== "waiting") {
        return Response.json({ ok: true, state: toClientState(gameState) });
      }
      if (gameState.players.length < 1) {
        return Response.json({ error: "No hay jugadores" }, { status: 400 });
      }
      gameState = startBetting(gameState);
      break;
    }

    case "auto_clear": {
      if (gameState.phase !== "finished") {
        return Response.json({ ok: true, state: toClientState(gameState) });
      }
      const elapsed = Date.now() - (gameState.roundEndedAt ?? 0);
      if (elapsed < RESULTS_DELAY_MS) {
        return Response.json({ ok: true, state: toClientState(gameState) });
      }
      gameState = autoClearTable(gameState);
      break;
    }

    case "auto_deal": {
      if (gameState.phase !== "betting") {
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
          const didBet = p.hands.length > 0 && p.hands[0].bet > 0;
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
        (p) => p.hands.length > 0 && p.hands[0].bet > 0,
      );
      if (!hasBetters) {
        gameState = {
          ...gameState,
          bettingStartedAt: Date.now(),
          message: "Nadie aposto — nuevo turno de apuestas",
        };
        break;
      }
      gameState = dealInitialCards(gameState);
      const { state: dealt } = runToCompletion(gameState);
      gameState = dealt;
      break;
    }

    case "rebuy": {
      const player = gameState.players.find((p) => p.id === playerId);
      if (!player || player.chips >= gameState.minBet) {
        return Response.json({ error: "No necesitas recargar" }, { status: 400 });
      }
      if (player.hands.some((h) => h.bet > 0)) {
        return Response.json(
          { error: "Ya apostaste esta ronda; espera a la siguiente" },
          { status: 400 },
        );
      }
      gameState = rebuyPlayer(gameState, playerId);
      break;
    }

    case "bet": {
      if (gameState.phase !== "betting") {
        return Response.json({ error: "No es momento de apostar" }, { status: 400 });
      }
      if (!amount || amount <= 0) {
        return Response.json({ error: "Apuesta inválida" }, { status: 400 });
      }
      gameState = placeBet(gameState, playerId, amount);

      if (allBetsPlaced(gameState)) {
        gameState = dealInitialCards(gameState);
        const { state } = runToCompletion(gameState);
        gameState = state;
      }
      break;
    }

    case "hit":
    case "stand":
    case "double":
    case "split":
    case "surrender": {
      if (gameState.phase !== "playing") {
        return Response.json({ error: "No es momento de jugar" }, { status: 400 });
      }
      gameState = playerAction(gameState, playerId, action);
      const { state } = runToCompletion(gameState);
      gameState = state;
      break;
    }

    default:
      return Response.json({ error: "Acción inválida" }, { status: 400 });
  }

  const newStatus =
    gameState.phase === "waiting" ? "waiting" :
    gameState.phase === "finished" ? "waiting" :
    "playing";

  const { error: updateError } = await sb
    .from("game_tables")
    .update({
      game_state: toClientState(gameState),
      deck_data: serializeDeck(gameState.deck),
      status: newStatus,
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
