import { getSupabase } from "@/lib/supabase";
import {
  removePlayer,
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
  const { playerId } = (await request.json()) as { playerId: string };

  if (!playerId) {
    return Response.json({ error: "Falta playerId" }, { status: 400 });
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

  const gameState: GameState = {
    ...table.game_state,
    deck: deserializeDeck(table.deck_data),
  };

  const leavingPlayer = gameState.players.find((p) => p.id === playerId);
  if (!leavingPlayer) {
    return Response.json({ ok: true });
  }

  const updated = removePlayer(gameState, playerId);
  const newCount = updated.players.length;

  if (newCount === 0) {
    await sb.from("game_tables").update({ status: "finished" }).eq("id", id);
    await broadcastToTable(id, { type: "table_closed" });
    return Response.json({ ok: true, tableClosed: true });
  }

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
    type: "player_left",
    playerName: leavingPlayer.name,
    playerCount: newCount,
  });

  await broadcastToTable(id, {
    type: "state_update",
    state: toClientState(updated),
  });

  return Response.json({ ok: true });
}
