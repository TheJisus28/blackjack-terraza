import { getSupabase } from "@/shared/lib/supabase";
import {
  removePlayer,
  completeRoundIfDealerTurnAfterLeave,
  deserializeDeck,
  serializeDeck,
  toClientState,
} from "@/game/simulation/blackjack/engine";
import type { GameState } from "@/game/simulation/blackjack/types";
import { lobbyTableStatusAfterSeatEvent } from "@/game/simulation/blackjack/table-row-status";
import { broadcastToTable } from "@/shared/lib/broadcast";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { playerId } = (await request.json()) as { playerId: string };

  if (!playerId) {
    return Response.json({ error: "Missing playerId" }, { status: 400 });
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

  const gameState: GameState = {
    ...table.game_state,
    deck: deserializeDeck(table.deck_data),
  };

  const leavingPlayer = gameState.players.find((p) => p.id === playerId);
  if (!leavingPlayer) {
    return Response.json({ ok: true });
  }

  let updated = removePlayer(gameState, playerId);
  const newCount = updated.players.length;

  if (newCount === 0) {
    await sb.from("game_tables").delete().eq("id", id);
    await broadcastToTable(id, { type: "table_closed" });
    return Response.json({ ok: true, tableClosed: true });
  }

  updated = completeRoundIfDealerTurnAfterLeave(gameState, updated);

  // Transfer creator if the creator left
  const updateFields: Record<string, unknown> = {
    game_state: toClientState(updated),
    deck_data: serializeDeck(updated.deck),
    player_count: newCount,
    status: lobbyTableStatusAfterSeatEvent(updated.phase),
  };

  if (playerId === table.creator_id && updated.players.length > 0) {
    const newCreator = updated.players[0];
    updateFields.creator_id = newCreator.id;
    updateFields.created_by = newCreator.name;
  }

  const { error: updateError } = await sb
    .from("game_tables")
    .update(updateFields)
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
