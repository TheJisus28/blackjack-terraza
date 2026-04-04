import { getSupabase } from "@/lib/supabase";
import {
  addPlayer,
  deserializeDeck,
  serializeDeck,
  toClientState,
} from "@/lib/blackjack/engine";
import type { GameState } from "@/lib/blackjack/types";
import { broadcastToTable } from "@/lib/broadcast";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { playerId, playerName } = (await request.json()) as {
    playerId: string;
    playerName: string;
  };

  if (!playerId || !playerName) {
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

  if (table.player_count >= table.max_players) {
    return Response.json({ error: "Mesa llena" }, { status: 400 });
  }

  const gameState: GameState = {
    ...table.game_state,
    deck: deserializeDeck(table.deck_data),
  };

  if (gameState.players.some((p: { id: string }) => p.id === playerId)) {
    return Response.json({ ok: true, alreadyJoined: true });
  }

  const updated = addPlayer(gameState, playerId, playerName);
  const newCount = updated.players.length;

  const { error: updateError } = await sb
    .from("game_tables")
    .update({
      game_state: toClientState(updated),
      deck_data: serializeDeck(updated.deck),
      player_count: newCount,
    })
    .eq("id", id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  await broadcastToTable(id, {
    type: "player_joined",
    playerName,
    playerCount: newCount,
  });

  await broadcastToTable(id, {
    type: "state_update",
    state: toClientState(updated),
  });

  return Response.json({ ok: true });
}
