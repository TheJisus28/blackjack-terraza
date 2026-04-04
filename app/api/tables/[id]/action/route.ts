import { getSupabase } from "@/lib/supabase";
import {
  placeBet,
  dealInitialCards,
  playerAction,
  runToCompletion,
  startBetting,
  allBetsPlaced,
  toClientState,
  deserializeDeck,
  serializeDeck,
} from "@/lib/blackjack/engine";
import type { GameState, PlayerAction } from "@/lib/blackjack/types";
import { broadcastToTable } from "@/lib/broadcast";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as {
    playerId: string;
    action: "bet" | "start_round" | PlayerAction;
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
    case "start_round": {
      if (playerId !== table.creator_id) {
        return Response.json({ error: "Solo el admin puede iniciar" }, { status: 403 });
      }
      if (gameState.phase !== "waiting" && gameState.phase !== "finished") {
        return Response.json({ error: "No se puede iniciar ahora" }, { status: 400 });
      }
      gameState = startBetting(gameState);
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
    gameState.phase === "waiting"
      ? "waiting"
      : gameState.phase === "finished"
        ? "waiting"
        : "playing";

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
